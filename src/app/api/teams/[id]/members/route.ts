import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

interface MemberRecord {
  id: string
  user_id: string
  role: string
  email: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: teamId } = await params
  const adminSupabase = createAdminClient()

  // Verify the caller is a member of this team
  const { data: membership } = await adminSupabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all team members for the team
  const { data: teamMembers, error: membersError } = await adminSupabase
    .from('team_members')
    .select('id, user_id, role')
    .eq('team_id', teamId)

  if (membersError || !teamMembers) {
    console.error('Failed to fetch team members:', membersError)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  // Resolve each user_id to an email via the Auth admin API
  const members: MemberRecord[] = await Promise.all(
    teamMembers.map(async (m) => {
      const { data } = await adminSupabase.auth.admin.getUserById(m.user_id)
      const authUser: User | null = data.user
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role as string,
        email: authUser?.email ?? m.user_id,
      }
    })
  )

  return NextResponse.json({ members })
}
