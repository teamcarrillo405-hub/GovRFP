import { createClient } from '@/lib/supabase/server'

export type ProposalRole = 'owner' | 'editor' | 'viewer' | 'none'

export interface ProposalRoleResult {
  role: ProposalRole
  hasAccess: boolean
  isOwner: boolean
  canEdit: boolean
}

const ROLE_ORDER: Record<ProposalRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
  none: 0,
}

export async function requireProposalRole(
  proposalId: string,
  minRole: ProposalRole
): Promise<ProposalRoleResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Load proposal (RLS already filters — but we need user_id + team_id)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('user_id, team_id')
    .eq('id', proposalId)
    .single()

  if (!proposal) return null

  let role: ProposalRole = 'none'

  // 2. Solo owner check
  if (proposal.user_id === user.id) {
    role = 'owner'
  } else if (proposal.team_id) {
    // 3. Team membership check
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', proposal.team_id)
      .eq('user_id', user.id)
      .single()

    if (member) {
      // Check if this user is the team owner
      const { data: team } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', proposal.team_id)
        .single()
      role = team?.owner_id === user.id ? 'owner' : (member.role as ProposalRole)
    }
  }

  const result: ProposalRoleResult = {
    role,
    hasAccess: ROLE_ORDER[role] >= ROLE_ORDER['viewer'],
    isOwner: role === 'owner',
    canEdit: ROLE_ORDER[role] >= ROLE_ORDER['editor'],
  }

  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) return null
  return result
}
