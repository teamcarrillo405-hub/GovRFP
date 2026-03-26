import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  proposal_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { name, proposal_id } = parsed.data
  const adminSupabase = createAdminClient()

  // 1. Insert team
  const { data: team, error: teamError } = await adminSupabase
    .from('teams')
    .insert({ owner_id: user.id, name, seat_count: 1 })
    .select()
    .single()

  if (teamError || !team) {
    console.error('Failed to create team:', teamError)
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  }

  // 2. Insert owner as first team member
  const { error: memberError } = await adminSupabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    console.error('Failed to insert team owner as member:', memberError)
    return NextResponse.json({ error: 'Failed to add owner to team' }, { status: 500 })
  }

  // 3. Link proposal to team (only if caller owns the proposal)
  const { error: proposalError } = await adminSupabase
    .from('proposals')
    .update({ team_id: team.id })
    .eq('id', proposal_id)
    .eq('user_id', user.id)

  if (proposalError) {
    console.error('Failed to link proposal to team:', proposalError)
    // Non-fatal — team was created successfully
  }

  return NextResponse.json({ team }, { status: 201 })
}
