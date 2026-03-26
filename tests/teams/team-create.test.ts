import { describe, it } from 'vitest'

describe('POST /api/teams', () => {
  it.todo('creates team with owner as first member')
  it.todo('returns 401 for unauthenticated')
  it.todo('sets team.owner_id to auth user')
  it.todo('inserts owner into team_members with role=owner')
})
