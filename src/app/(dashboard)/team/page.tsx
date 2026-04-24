import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TeamMembersPanel from '@/components/team/TeamMembersPanel'
import PendingInvitesList from '@/components/team/PendingInvitesList'
import DangerZone from '@/components/team/DangerZone'

interface TeamRow {
  id: string
  name: string
  owner_id: string
  seat_count: number
  max_seats: number | null
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

export const metadata = { title: 'Team Management — HCC ProposalAI' }

export default async function TeamPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Find the user's team membership (take first team if multiple)
  const { data: memberships } = await supabase
    .from('team_members')
    .select('role, team_id, teams(id, name, owner_id, seat_count, max_seats)')
    .eq('user_id', user.id)
    .limit(1)

  if (!memberships || memberships.length === 0) {
    // No team yet — redirect to dashboard
    redirect('/dashboard')
  }

  const raw = memberships[0] as unknown as MembershipRow
  const team = raw.teams
  const userRole = raw.role
  const isAdmin = userRole === 'owner' || userRole === 'editor'
  const isOwner = userRole === 'owner'

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

  const seatCount = team.seat_count ?? 0
  const maxSeats = team.max_seats ?? null

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-sans">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Team Management</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {team.name}
          {maxSeats !== null
            ? ` · ${seatCount}/${maxSeats} seats used`
            : ` · ${seatCount} member${seatCount !== 1 ? 's' : ''}`}
          {' · '}
          <span className="capitalize">{userRole}</span>
        </p>
      </div>

      {/* ── Members + Invite (client) ── */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <TeamMembersPanel teamId={team.id} isAdmin={isAdmin} />
      </section>

      {/* ── Pending invites (admin only) ── */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Pending Invites
          </h2>
          <PendingInvitesList
            teamId={team.id}
            invites={pendingInvites}
            isAdmin={isAdmin}
          />
        </section>
      )}

      {/* ── Danger zone ── */}
      <section>
        <DangerZone teamId={team.id} isOwner={isOwner} />
      </section>
    </main>
  )
}
