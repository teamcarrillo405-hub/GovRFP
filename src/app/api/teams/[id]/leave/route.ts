import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** POST /api/teams/[id]/leave — non-owner member leaves the team */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: teamId } = await params
  const admin = createAdminClient()

  // Find the membership row
  const { data: membership } = await admin
    .from('team_members')
    .select('id, role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 })

  // Owners must delete the team instead of leaving
  if (membership.role === 'owner') {
    return NextResponse.json(
      { error: 'Owner cannot leave. Delete the team instead.' },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from('team_members')
    .delete()
    .eq('id', membership.id)

  if (error) {
    console.error('Failed to leave team:', error)
    return NextResponse.json({ error: 'Failed to leave team' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
