import { describe, it, expect } from 'vitest'
import { profileSchema } from '@/lib/validators/profile'

describe('PROFILE-04: Capability Statement - 2000 Character Limit', () => {
  it('accepts capability statement under 2000 characters', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: [],
      capability_statement: 'A'.repeat(1999),
    })
    expect(result.success).toBe(true)
  })

  it('accepts capability statement at exactly 2000 characters', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: [],
      capability_statement: 'A'.repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it('rejects capability statement over 2000 characters', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: [],
      capability_statement: 'A'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty capability statement', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: [],
      capability_statement: '',
    })
    expect(result.success).toBe(true)
  })
})
