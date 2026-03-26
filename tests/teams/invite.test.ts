import { describe, it } from 'vitest'

describe('POST /api/teams/invite', () => {
  it.todo('creates team_invites record with status=pending')
  it.todo('calls inviteUserByEmail for new user')
  it.todo('handles existing user gracefully (does not throw)')
  it.todo('returns 403 for non-owner')
  it.todo('returns 400 for invalid email')
})

describe('POST /api/teams/invite/accept', () => {
  it.todo('marks invite accepted and inserts team_member')
  it.todo('increments seat_count')
  it.todo('returns 400 for invalid/expired invite')
})

describe('POST /api/teams/invite/decline', () => {
  it.todo('marks invite declined')
})
