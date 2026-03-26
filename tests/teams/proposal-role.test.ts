import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

const USER_ID = 'user-111'
const PROPOSAL_ID = 'proposal-aaa'
const TEAM_ID = 'team-bbb'

function buildMockSupabase(overrides: {
  user?: { id: string } | null
  proposal?: { user_id: string; team_id: string | null } | null
  member?: { role: string } | null
  team?: { owner_id: string } | null
}) {
  const { user, proposal, member, team } = overrides

  const makeQuery = (data: unknown, error: boolean = !data) => {
    const base = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: error ? { message: 'not found' } : null }),
    }
    return base
  }

  const fromMap: Record<string, unknown> = {
    proposals: makeQuery(proposal ?? null, proposal === null),
    team_members: makeQuery(member ?? null, member === null),
    teams: makeQuery(team ?? null, team === null),
  }

  const mockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user !== undefined ? user : { id: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => fromMap[table] ?? makeQuery(null, true)),
  }
  return mockClient
}

describe('requireProposalRole()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns owner role for proposal.user_id match', async () => {
    const mock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: USER_ID, team_id: null },
    })
    vi.mocked(createClient).mockResolvedValue(mock as ReturnType<typeof buildMockSupabase>)

    const result = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(result).not.toBeNull()
    expect(result!.role).toBe('owner')
    expect(result!.isOwner).toBe(true)
    expect(result!.hasAccess).toBe(true)
    expect(result!.canEdit).toBe(true)
  })

  it('returns editor role for team member with editor role', async () => {
    const mock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: 'someone-else', team_id: TEAM_ID },
      member: { role: 'editor' },
      team: { owner_id: 'someone-else' },
    })
    vi.mocked(createClient).mockResolvedValue(mock as ReturnType<typeof buildMockSupabase>)

    const result = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(result).not.toBeNull()
    expect(result!.role).toBe('editor')
    expect(result!.isOwner).toBe(false)
    expect(result!.canEdit).toBe(true)
    expect(result!.hasAccess).toBe(true)
  })

  it('returns viewer role for team member with viewer role', async () => {
    const mock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: 'someone-else', team_id: TEAM_ID },
      member: { role: 'viewer' },
      team: { owner_id: 'someone-else' },
    })
    vi.mocked(createClient).mockResolvedValue(mock as ReturnType<typeof buildMockSupabase>)

    const result = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(result).not.toBeNull()
    expect(result!.role).toBe('viewer')
    expect(result!.isOwner).toBe(false)
    expect(result!.canEdit).toBe(false)
    expect(result!.hasAccess).toBe(true)
  })

  it('returns null for non-member (access denied)', async () => {
    const mock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: 'someone-else', team_id: TEAM_ID },
      member: null,
    })
    vi.mocked(createClient).mockResolvedValue(mock as ReturnType<typeof buildMockSupabase>)

    const result = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(result).toBeNull()
  })

  it('returns null when minRole exceeds actual role', async () => {
    const mock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: 'someone-else', team_id: TEAM_ID },
      member: { role: 'viewer' },
      team: { owner_id: 'someone-else' },
    })
    vi.mocked(createClient).mockResolvedValue(mock as ReturnType<typeof buildMockSupabase>)

    const result = await requireProposalRole(PROPOSAL_ID, 'editor')
    expect(result).toBeNull()
  })

  it('canEdit is true for owner and editor, false for viewer', async () => {
    // Owner
    const ownerMock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: USER_ID, team_id: null },
    })
    vi.mocked(createClient).mockResolvedValue(ownerMock as ReturnType<typeof buildMockSupabase>)
    const ownerResult = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(ownerResult!.canEdit).toBe(true)

    // Team owner (via owner_id match)
    const teamOwnerMock = buildMockSupabase({
      user: { id: USER_ID },
      proposal: { user_id: 'someone-else', team_id: TEAM_ID },
      member: { role: 'owner' },
      team: { owner_id: USER_ID },
    })
    vi.mocked(createClient).mockResolvedValue(teamOwnerMock as ReturnType<typeof buildMockSupabase>)
    const teamOwnerResult = await requireProposalRole(PROPOSAL_ID, 'viewer')
    expect(teamOwnerResult!.role).toBe('owner')
    expect(teamOwnerResult!.canEdit).toBe(true)
  })
})
