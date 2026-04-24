import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/teams/[id] — fetch team + member count for team page header */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: teamId } = await params
  const admin = createAdminClient()

  // Verify caller is a member
  const { data: membership } = await admin
    .from('team_members')
    .select('id, role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: team } = await admin
    .from('teams')
    .select('id, name, owner_id, seat_count, max_seats')
    .eq('id', teamId)
    .single()

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ team, userRole: membership.role })
}

/** DELETE /api/teams/[id] — owner deletes (dissolves) the entire team */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: teamId } = await params
  const admin = createAdminClient()

  // Only the owner may delete the team
  const { data: team } = await admin
    .from('teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .eq('owner_id', user.id)
    .single()

  if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Cascade: remove invites, members, then team
  await admin.from('team_invites').delete().eq('team_id', teamId)
  await admin.from('team_members').delete().eq('team_id', teamId)
  const { error } = await admin.from('teams').delete().eq('id', teamId)

  if (error) {
    console.error('Failed to delete team:', error)
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
