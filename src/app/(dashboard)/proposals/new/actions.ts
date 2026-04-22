'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'

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
 */

const govRfpSchema = z.object({
  govrfp_id: z.string().uuid().optional(),
  solicitation: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  agency: z.string().max(200).optional(),
  naics: z.string().regex(/^\d{6}$/).optional(),
  set_aside: z.string().max(50).optional(),
  deadline: z.string().optional(),
  pop_state: z.string().length(2).optional(),
  source_url: z.string().url().optional(),
  scope: z.string().max(2000).optional(),
})

export type GovRfpHandoffInput = z.infer<typeof govRfpSchema>

export async function createProposalFromGovRfp(input: GovRfpHandoffInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    redirect('/account?reason=subscription-required')
  }

  const parsed = govRfpSchema.safeParse(input)
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

  redirect(`/proposals/${proposal.id}?from=govrfp`)
}
