import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const patchSchema = z.object({
  role: z.enum(['editor', 'viewer']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  // Load the member to get team_id
  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id, team_id, role')
    .eq('id', id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Verify caller is team owner
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id')
    .eq('id', member.team_id)
    .eq('owner_id', user.id)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { role } = parsed.data

  const { error: updateError } = await adminSupabase
    .from('team_members')
    .update({ role })
    .eq('id', id)

  if (updateError) {
    console.error('Failed to update member role:', updateError)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const adminSupabase = createAdminClient()

  // Load the member to get team_id
  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id, team_id')
    .eq('id', id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Verify caller is team owner
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id')
    .eq('id', member.team_id)
    .eq('owner_id', user.id)
    .single()

  if (!team) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await adminSupabase
    .from('team_members')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Failed to delete team member:', deleteError)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }

  // Recalculate seat_count from actual member count (race-safe)
  const { count } = await adminSupabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', member.team_id)

  await adminSupabase
    .from('teams')
    .update({ seat_count: count ?? 1 })
    .eq('id', member.team_id)

  return NextResponse.json({ ok: true })
}
