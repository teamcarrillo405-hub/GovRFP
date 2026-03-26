import { describe, it } from 'vitest'

describe('requireProposalRole()', () => {
  it.todo('returns owner role for proposal.user_id match')
  it.todo('returns editor role for team member with editor role')
  it.todo('returns viewer role for team member with viewer role')
  it.todo('returns null for non-member (access denied)')
  it.todo('returns null when minRole exceeds actual role')
  it.todo('canEdit is true for owner and editor, false for viewer')
})
