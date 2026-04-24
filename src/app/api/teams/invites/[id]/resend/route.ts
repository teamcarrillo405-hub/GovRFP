import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** POST /api/teams/invites/[id]/resend — resend an existing pending invite email */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: inviteId } = await params
  const admin = createAdminClient()

  // Load the invite
  const { data: invite } = await admin
    .from('team_invites')
    .select('id, team_id, invitee_email, role, status')
    .eq('id', inviteId)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending invites can be resent' }, { status: 400 })
  }

  // Verify caller is team owner
  const { data: team } = await admin
    .from('teams')
    .select('id')
    .eq('id', invite.team_id)
    .eq('owner_id', user.id)
    .single()

  if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const acceptUrl =
    process.env.NEXT_PUBLIC_URL +
    '/invite/accept?invite_id=' +
    invite.id +
    '&team_id=' +
    invite.team_id

  // Try existing-user path first (magic link), fall back to inviteUserByEmail
  let sent = false
  try {
    const { error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: invite.invitee_email,
      options: { redirectTo: acceptUrl },
    })
    if (!linkError) sent = true
  } catch {
    // fall through
  }

  if (!sent) {
    try {
      await admin.auth.admin.inviteUserByEmail(invite.invitee_email, {
        redirectTo: process.env.NEXT_PUBLIC_URL + '/invite/accept',
        data: { team_id: invite.team_id, role: invite.role, invite_id: invite.id },
      })
    } catch (err) {
      console.error('resend invite error:', err)
      return NextResponse.json({ error: 'Failed to resend invite' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
