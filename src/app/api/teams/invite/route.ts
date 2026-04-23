import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const inviteSchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
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

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { team_id, email, role } = parsed.data
  const adminSupabase = createAdminClient()

  // Verify caller is team owner
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id')
    .eq('id', team_id)
    .eq('owner_id', user.id)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if email is already a member via existing invite or team_members
  const { data: existingInvite } = await adminSupabase
    .from('team_invites')
    .select('id, status')
    .eq('team_id', team_id)
    .eq('invitee_email', email)
    .single()

  if (existingInvite && existingInvite.status === 'accepted') {
    return NextResponse.json(
      { error: `${email} is already a team member.` },
      { status: 400 }
    )
  }

  // Insert invite record (upsert to handle declined -> re-invite)
  const { data: invite, error: inviteError } = await adminSupabase
    .from('team_invites')
    .upsert(
      { team_id, invited_by: user.id, invitee_email: email, role, status: 'pending' },
      { onConflict: 'team_id,invitee_email' }
    )
    .select()
    .single()

  if (inviteError || !invite) {
    console.error('Failed to create invite:', inviteError)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  // Try to send email invite via Supabase Auth
  let existingUser = false
  try {
    const { error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_URL + '/invite/accept',
      data: { team_id, role, invite_id: invite.id },
    })

    if (authError) {
      // If already registered, that's fine — invite DB record exists
      if (
        authError.message?.includes('already registered') ||
        authError.message?.includes('already been registered')
      ) {
        existingUser = true
      } else {
        console.error('inviteUserByEmail error:', authError)
        // Non-fatal — DB record was inserted, user can still accept via link
      }
    }
  } catch (err) {
    console.error('inviteUserByEmail threw:', err)
    // Non-fatal
  }

  return NextResponse.json({ invited: true, existing_user: existingUser })
}
