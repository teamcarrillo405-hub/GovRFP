import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeamMembersPanel from '@/components/team/TeamMembersPanel'
import PendingInvitesList from '@/components/team/PendingInvitesList'
import DangerZone from '@/components/team/DangerZone'
import { UserPlus, Users } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'

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

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#C0C2C6',
}

export default async function TeamPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
            Team
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.55)', marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
            {team.name} · <span style={{ textTransform: 'capitalize' }}>{userRole}</span>
          </p>
        </div>
      </div>

      {/* Members section */}
      <GlassPanel noPad style={{ marginBottom: 20 }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(192,194,198,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Users size={14} strokeWidth={1.5} style={{ color: 'rgba(192,194,198,0.45)' }} />
          <span style={SECTION_LABEL}>Members</span>
        </div>
        <div style={{ padding: '4px 0' }}>
          <TeamMembersPanel teamId={team.id} isAdmin={isAdmin} />
        </div>
      </GlassPanel>

      {/* Pending invitations */}
      {isAdmin && (
        <GlassPanel noPad style={{ marginBottom: 20 }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(192,194,198,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <UserPlus size={14} strokeWidth={1.5} style={{ color: 'rgba(192,194,198,0.45)' }} />
            <span style={SECTION_LABEL}>Pending Invitations</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            <PendingInvitesList
              teamId={team.id}
              invites={pendingInvites}
              isAdmin={isAdmin}
            />
          </div>
        </GlassPanel>
      )}

      {/* Danger zone */}
      <DangerZone teamId={team.id} isOwner={isOwner} />
    </div>
  )
}
