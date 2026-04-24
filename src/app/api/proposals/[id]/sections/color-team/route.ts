import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

export type ColorTeamStatus = 'white' | 'pink' | 'red' | 'gold' | 'final'

const VALID_STATUSES: ColorTeamStatus[] = ['white', 'pink', 'red', 'gold', 'final']

function isValidStatus(v: unknown): v is ColorTeamStatus {
  return typeof v === 'string' && (VALID_STATUSES as string[]).includes(v)
}

// GET /api/proposals/[id]/sections/color-team
// Returns all sections' color team status for this proposal
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'viewer')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('proposal_sections')
    .select('section_name, color_team_status, color_team_updated_at, color_team_notes')
    .eq('proposal_id', proposalId)
    .order('section_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load color team status' }, { status: 500 })
  }

  const sections = (data ?? []).map((row) => ({
    sectionName: row.section_name as string,
    status: (row.color_team_status ?? 'white') as ColorTeamStatus,
    updatedAt: row.color_team_updated_at as string | null,
    notes: (row.color_team_notes ?? '') as string,
  }))

  return NextResponse.json({ sections })
}

// PATCH /api/proposals/[id]/sections/color-team
// Body: { sectionName: string, status: ColorTeamStatus, notes?: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { sectionName, status, notes } = body as {
    sectionName: unknown
    status: unknown
    notes?: unknown
  }

  if (typeof sectionName !== 'string' || !sectionName.trim()) {
    return NextResponse.json({ error: 'sectionName is required' }, { status: 400 })
  }
  if (!isValidStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('proposal_sections')
    .upsert(
      {
        proposal_id: proposalId,
        user_id: user.id,
        section_name: sectionName,
        color_team_status: status,
        color_team_updated_at: new Date().toISOString(),
        color_team_notes: typeof notes === 'string' ? notes : '',
      },
      { onConflict: 'proposal_id,section_name' }
    )
    .select('section_name, color_team_status, color_team_updated_at, color_team_notes')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update color team status' }, { status: 500 })
  }

  return NextResponse.json({
    sectionName: data.section_name,
    status: data.color_team_status,
    updatedAt: data.color_team_updated_at,
    notes: data.color_team_notes ?? '',
  })
}
