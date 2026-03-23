import { describe, it } from 'vitest'

describe('POST /api/proposals/[id]/draft', () => {
  it.todo('returns 401 when user not authenticated')
  it.todo('returns 402 when subscription inactive')
  it.todo('accepts valid section name in body')
  it.todo('rejects invalid section name')
  it.todo('passes instruction to prompt builder when provided')
})
