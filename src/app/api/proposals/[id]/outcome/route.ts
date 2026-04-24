import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'

const VALID_OUTCOMES = ['won', 'lost', 'no_bid', 'pending'] as const
type Outcome = (typeof VALID_OUTCOMES)[number]

interface OutcomeBody {
  outcome: Outcome
  submitted_at?: string
  contract_value?: number
  outcome_notes?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id: proposalId } = await params

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: OutcomeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { outcome, submitted_at, contract_value, outcome_notes } = body

  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const updatePayload: Record<string, unknown> = {
    outcome,
    updated_at: new Date().toISOString(),
  }
  if (submitted_at !== undefined) updatePayload.submitted_at = submitted_at
  if (contract_value !== undefined) updatePayload.contract_value = contract_value
  if (outcome_notes !== undefined) updatePayload.outcome_notes = outcome_notes

  // TODO: Once team invitations are live and members can accept invites, update
  // this filter to also allow team members (not just the proposal creator) to
  // save outcomes. For now only the owner (user_id) can save.
  const { error } = await supabase
    .from('proposals')
    .update(updatePayload)
    .eq('id', proposalId)
    .eq('user_id', user.id)

  if (error) {
    console.error('outcome PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 })
  }

  // Auto-create a past performance record when a proposal is marked Won.
  // Idempotent: skip if one already exists for this proposal.
  let ppRecordId: string | null = null
  if (outcome === 'won') {
    ppRecordId = await autoCreatePastPerformance({
      supabase,
      userId: user.id,
      proposalId,
      contractValue: contract_value ?? null,
      outcomeNotes: outcome_notes ?? null,
    })
  }

  return NextResponse.json({ success: true, pp_record_id: ppRecordId })
}

// ---------------------------------------------------------------------------

async function autoCreatePastPerformance({
  supabase,
  userId,
  proposalId,
  contractValue,
  outcomeNotes,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  proposalId: string
  contractValue: number | null
  outcomeNotes: string | null
}): Promise<string | null> {
  // Skip if a PP record already sourced from this proposal exists.
  const { data: existing } = await supabase
    .from('past_performance')
    .select('id')
    .eq('source_proposal_id', proposalId)
    .maybeSingle()

  if (existing) return existing.id

  // Load proposal + rfp_analysis in parallel.
  const [{ data: proposal }, { data: analysis }] = await Promise.all([
    supabase
      .from('proposals')
      .select('title, team_id, submitted_at')
      .eq('id', proposalId)
      .single(),
    supabase
      .from('rfp_analysis')
      .select('naics_codes, set_asides_detected, win_factors')
      .eq('proposal_id', proposalId)
      .maybeSingle(),
  ])

  if (!proposal) return null

  // Pull agency + solicitation from the GovRFP handoff metadata if present.
  const wf = analysis?.win_factors as Record<string, unknown> | null
  const agency: string | null =
    typeof wf?.agency === 'string' ? wf.agency : null
  const solicitation: string | null =
    typeof wf?.solicitation === 'string' ? wf.solicitation : null

  const naicsCodes: string[] =
    Array.isArray(analysis?.naics_codes) ? (analysis.naics_codes as string[]) : []
  const setAsides: string[] =
    Array.isArray(analysis?.set_asides_detected)
      ? (analysis.set_asides_detected as string[])
      : []

  // Derive a minimal scope_narrative from what we know. Required field (min 1).
  const scopeParts = [
    `${proposal.title}.`,
    agency ? `Customer: ${agency}.` : null,
    contractValue ? `Contract value: $${Number(contractValue).toLocaleString()}.` : null,
    outcomeNotes ? `Notes: ${outcomeNotes}` : null,
    'Update this narrative with your actual past-performance description.',
  ].filter(Boolean)

  const ppInput: Record<string, unknown> = {
    user_id: userId,
    team_id: proposal.team_id ?? null,
    source_proposal_id: proposalId,
    contract_title: proposal.title,
    contract_number: solicitation ?? null,
    customer_name: agency ?? 'Unknown agency',
    customer_agency_code: agency ?? null,
    period_end: proposal.submitted_at
      ? proposal.submitted_at.slice(0, 10)
      : null,
    contract_value_usd: contractValue ?? null,
    naics_codes: naicsCodes,
    set_asides_claimed: setAsides,
    scope_narrative: scopeParts.join(' '),
    key_personnel: [],
    outcomes: outcomeNotes ?? null,
    tags: ['auto-created'],
  }

  const { data: pp, error } = await supabase
    .from('past_performance')
    .insert(ppInput)
    .select('id')
    .single()

  if (error) {
    console.error('PP auto-create error:', error)
    return null
  }

  return pp.id
}
