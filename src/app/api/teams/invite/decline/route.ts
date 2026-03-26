import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const declineSchema = z.object({
  invite_id: z.string().uuid(),
})

// Note: decline does NOT require auth — user may be declining without an account
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = declineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { invite_id } = parsed.data
  const adminSupabase = createAdminClient()

  const { data: invite } = await adminSupabase
    .from('team_invites')
    .select('id')
    .eq('id', invite_id)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or already processed invite' }, { status: 400 })
  }

  await adminSupabase
    .from('team_invites')
    .update({ status: 'declined' })
    .eq('id', invite_id)

  return NextResponse.json({ ok: true })
}
