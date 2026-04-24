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

  // Build update payload (only include defined optional fields)
  const updatePayload: Record<string, unknown> = {
    outcome,
    updated_at: new Date().toISOString(),
  }
  if (submitted_at !== undefined) updatePayload.submitted_at = submitted_at
  if (contract_value !== undefined) updatePayload.contract_value = contract_value
  if (outcome_notes !== undefined) updatePayload.outcome_notes = outcome_notes

  const { error } = await supabase
    .from('proposals')
    .update(updatePayload)
    .eq('id', proposalId)
    .eq('user_id', user.id)

  if (error) {
    console.error('outcome PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
