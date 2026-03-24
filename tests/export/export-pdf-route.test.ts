import { describe, it } from 'vitest'

describe('POST /api/proposals/[id]/export/pdf', () => {
  it.todo('returns 401 for unauthenticated request')
  it.todo('returns 404 when proposal has no sections')
  it.todo('returns 200 with correct Content-Type application/pdf')
  it.todo('returns Content-Disposition attachment header with filename')
  it.todo('returns non-empty body')
})
