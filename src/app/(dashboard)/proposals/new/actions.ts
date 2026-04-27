'use server'

import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { govRfpHandoffSchema, type GovRfpHandoffInput } from '@/lib/bridge/govrfp-handoff'

export async function createProposalFromOpportunity(opportunityId: string) {
  const user = await getUser()
  if (!user) redirect('/login')

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    redirect('/account?reason=subscription-required')
  }

  const supabase = await createClient()
  const { data: opp } = await (supabase as any)
    .from('opportunities')
    .select('id, title, agency, agency_name, solicitation_number, naics_code, set_aside, set_aside_description, due_date, response_deadline, place_of_performance_state, pop_state, sam_url, ui_link')
    .eq('id', opportunityId)
    .single()

  if (!opp) throw new Error('Opportunity not found')

  const title = opp.solicitation_number
    ? `${opp.solicitation_number} — ${opp.title}`
    : (opp.title ?? 'Untitled Proposal')

  const admin = createAdminClient()

  const { data: proposal, error } = await admin
    .from('proposals')
    .insert({
      user_id: user.id,
      title: title.slice(0, 200),
      status: 'draft',
      opportunity_id: opportunityId,
    })
    .select('id')
    .single()

  if (error || !proposal) throw new Error(`Failed to create proposal: ${error?.message ?? 'unknown'}`)

  const agency = opp.agency ?? opp.agency_name ?? null
  const setAside = opp.set_aside ?? opp.set_aside_description ?? null
  const deadline = opp.due_date ?? opp.response_deadline ?? null
  const popState = opp.place_of_performance_state ?? opp.pop_state ?? null
  const samUrl = opp.sam_url ?? opp.ui_link ?? null

  await admin.from('rfp_analysis').insert({
    proposal_id: proposal.id,
    user_id: user.id,
    requirements: [],
    compliance_matrix: [],
    win_score: null,
    win_factors: {
      opportunity_id: opportunityId,
      solicitation_number: opp.solicitation_number ?? null,
      agency,
      naics: opp.naics_code ?? null,
      place_of_performance: popState,
      response_deadline: deadline,
      source_portal_url: samUrl,
    },
    set_asides_detected: setAside ? [setAside] : [],
    set_aside_flags: [],
    section_lm_crosswalk: [],
    crosswalk_note: 'Pre-populated from SAM.gov opportunity — upload the RFP PDF from SAM.gov to run full analysis.',
    model_used: 'sam-gov-opportunity',
  })

  redirect(`/proposals/${proposal.id}`)
}

/**
 * GovRFP → ProposalAI bridge.
 *
 * When a user clicks "Send to ProposalAI" in GovRFP, they land on
 * /proposals/new?source=govrfp&...metadata. This action takes the validated
 * metadata, creates a proposal row, optionally seeds the rfp_analysis with
 * known set-aside info, and redirects to the proposal detail page.
 *
 * The user must still upload the full RFP PDF later for OCR-based scope
 * extraction — GovRFP only ships a summary description, not the full SoW.
 *
 * Schema lives in @/lib/bridge/govrfp-handoff so the URL parser in
 * page.tsx and this server action share the exact same validation rules.
 */
export async function createProposalFromGovRfp(input: GovRfpHandoffInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    redirect('/account?reason=subscription-required')
  }

  const parsed = govRfpHandoffSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid GovRFP handoff payload: ${parsed.error.issues[0]?.message}`)
  }

  const { title, solicitation, agency, naics, set_aside, deadline, pop_state, source_url, scope, govrfp_id } =
    parsed.data

  const admin = createAdminClient()

  // Build a richer title that includes the solicitation number for searchability
  const proposalTitle = solicitation ? `${solicitation} — ${title}` : title

  // 1. Create the proposal row (status=draft, ready for user to upload RFP PDF)
  const { data: proposal, error: proposalError } = await admin
    .from('proposals')
    .insert({
      user_id: user.id,
      title: proposalTitle.slice(0, 200),
      status: 'draft',
    })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    throw new Error(`Failed to create proposal: ${proposalError?.message ?? 'unknown'}`)
  }

  // 2. Seed rfp_analysis with what GovRFP already knows
  // (User will re-run analysis after uploading the full PDF — these are placeholders)
  const setAsidesDetected = set_aside ? [set_aside] : []
  const winFactors = {
    govrfp_handoff: true,
    govrfp_opportunity_id: govrfp_id,
    solicitation_number: solicitation,
    agency,
    naics,
    place_of_performance: pop_state,
    response_deadline: deadline,
    source_portal_url: source_url,
    scope_summary: scope ?? null,
  }

  const { error: analysisError } = await admin
    .from('rfp_analysis')
    .insert({
      proposal_id: proposal.id,
      user_id: user.id,
      requirements: [],
      compliance_matrix: [],
      win_score: null,
      win_factors: winFactors,
      set_asides_detected: setAsidesDetected,
      set_aside_flags: [],
      section_lm_crosswalk: [],
      crosswalk_note:
        'Pre-populated from GovRFP handoff — upload the full RFP PDF to run complete analysis (Sections L/M, requirements extraction, compliance matrix).',
      model_used: 'govrfp-handoff',
    })

  // analysisError is non-fatal — the proposal still exists. Log and continue.
  if (analysisError) {
    console.error('[govrfp-handoff] rfp_analysis seed failed:', analysisError.message)
  }

  // Bidirectional bridge: update the GovRFP pipeline card (if one exists) with this proposal ID.
  // Both apps share Supabase, so we can write directly to pipeline_cards.
  if (govrfp_id) {
    const { error: bridgeError } = await admin
      .from('pipeline_cards')
      .update({ proposal_ai_proposal_id: proposal.id })
      .eq('opportunity_id', govrfp_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (bridgeError) {
      console.error('[govrfp-handoff] pipeline bridge update failed:', bridgeError.message)
    }
  }

  redirect(`/proposals/${proposal.id}?from=govrfp`)
}
