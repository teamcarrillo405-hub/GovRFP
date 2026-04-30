import { describe, it, expect } from 'vitest'
import { extractBearer } from '../auth-helper'

describe('extractBearer', () => {
  it('returns token from valid Authorization header', () => {
    const req = new Request('http://localhost', {
      headers: { Authorization: 'Bearer abc123' },
    })
    expect(extractBearer(req)).toBe('abc123')
  })

  it('returns null when header is missing', () => {
    const req = new Request('http://localhost')
    expect(extractBearer(req)).toBeNull()
  })

  it('returns null when scheme is not Bearer', () => {
    const req = new Request('http://localhost', {
      headers: { Authorization: 'Basic abc123' },
    })
    expect(extractBearer(req)).toBeNull()
  })
})
