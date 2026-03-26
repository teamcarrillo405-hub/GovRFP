import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const acceptSchema = z.object({
  invite_id: z.string().uuid(),
  team_id: z.string().uuid(),
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

  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { invite_id, team_id } = parsed.data
  const adminSupabase = createAdminClient()

  // 1. Fetch and validate invite
  const { data: invite } = await adminSupabase
    .from('team_invites')
    .select('id, role, status')
    .eq('id', invite_id)
    .eq('team_id', team_id)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }

  // 2. Insert team member
  const { error: memberError } = await adminSupabase
    .from('team_members')
    .insert({ team_id, user_id: user.id, role: invite.role })

  if (memberError) {
    // May already be a member — check if this is a duplicate
    if (memberError.code === '23505') {
      // unique violation — already a member, still mark invite accepted
    } else {
      console.error('Failed to insert team member:', memberError)
      return NextResponse.json({ error: 'Failed to join team' }, { status: 500 })
    }
  }

  // 3. Mark invite accepted
  await adminSupabase
    .from('team_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite_id)

  // 4. Recalculate seat_count from actual member count (race-safe)
  const { count } = await adminSupabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team_id)

  await adminSupabase
    .from('teams')
    .update({ seat_count: count ?? 1 })
    .eq('id', team_id)

  return NextResponse.json({ ok: true })
}
