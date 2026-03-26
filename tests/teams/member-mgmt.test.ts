import { describe, it } from 'vitest'

describe('PATCH /api/teams/members/[id]', () => {
  it.todo('owner can change member role')
  it.todo('non-owner receives 403')
})

describe('DELETE /api/teams/members/[id]', () => {
  it.todo('owner can remove member')
  it.todo('decrements seat_count')
  it.todo('non-owner receives 403')
})
