import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeamMembersPanel from '@/components/team/TeamMembersPanel'
import PendingInvitesList from '@/components/team/PendingInvitesList'
import DangerZone from '@/components/team/DangerZone'
import { UserPlus, Users } from 'lucide-react'

interface TeamRow {
  id: string
  name: string
  owner_id: string
}

interface MembershipRow {
  role: string
  team_id: string
  teams: TeamRow
}

interface PendingInviteRow {
  id: string
  invitee_email: string
  role: string
  created_at: string
}

export const metadata = { title: 'Team Management — Avero' }

export default async function TeamPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Find the user's team membership (take first team if multiple)
  const { data: memberships } = await supabase
    .from('team_members')
    .select('role, team_id, teams(id, name, owner_id)')
    .eq('user_id', user.id)
    .limit(1)

  if (!memberships || memberships.length === 0) {
    redirect('/dashboard')
  }

  const raw = memberships[0] as unknown as MembershipRow
  const team = raw.teams
  const userRole = raw.role
  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'editor'
  const isOwner = userRole === 'owner' || userRole === 'admin'

  // Fetch pending invites server-side (only admins need this; members get empty list)
  let pendingInvites: PendingInviteRow[] = []
  if (isAdmin) {
    const admin = createAdminClient()
    const { data: invites } = await admin
      .from('team_invites')
      .select('id, invitee_email, role, created_at')
      .eq('team_id', team.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    pendingInvites = (invites ?? []) as PendingInviteRow[]
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Team</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
            {team.name} · <span style={{ textTransform: 'capitalize' }}>{userRole}</span>
          </p>
        </div>
      </div>

      {/* Members section */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} strokeWidth={1.5} style={{ color: '#94A3B8' }} />
          Members
        </div>
        <div style={{ padding: '4px 0' }}>
          <TeamMembersPanel teamId={team.id} isAdmin={isAdmin} />
        </div>
      </div>

      {/* Pending invitations */}
      {isAdmin && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={15} strokeWidth={1.5} style={{ color: '#94A3B8' }} />
            Pending Invitations
          </div>
          <div style={{ padding: '4px 0' }}>
            <PendingInvitesList
              teamId={team.id}
              invites={pendingInvites}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* Danger zone */}
      <DangerZone teamId={team.id} isOwner={isOwner} />
    </div>
  )
}
