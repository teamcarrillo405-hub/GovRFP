import { describe, it, expect } from 'vitest'
import { createAddinClient } from '../supabase-client'

describe('createAddinClient', () => {
  it('exports a factory function', () => {
    expect(typeof createAddinClient).toBe('function')
  })
})
