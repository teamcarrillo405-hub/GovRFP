import { describe, it } from 'vitest'

describe('Dual RLS on proposals', () => {
  it.todo('solo policy: auth.uid() = user_id still grants access to own proposals')
  it.todo('team policy: team member can access proposal with matching team_id')
  it.todo('team policy: non-member cannot access team proposal')
})

describe('Dual RLS on proposal_sections', () => {
  it.todo('team member can access sections of team proposal')
  it.todo('non-member cannot access sections of team proposal')
})
