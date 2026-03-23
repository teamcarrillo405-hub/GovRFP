import { describe, it, expect } from 'vitest'
import { profileSchema, pastProjectSchema, keyPersonnelSchema, CERTIFICATION_OPTIONS } from '@/lib/validators/profile'

describe('PROFILE-01: Contractor Profile Validation', () => {
  it('accepts valid profile with all fields', () => {
    const result = profileSchema.safeParse({
      company_name: 'HCC Construction',
      uei_cage: 'ABC123',
      certifications: ['8(a)', 'HUBZone'],
      naics_codes: ['236220', '237310'],
      capability_statement: 'We build things.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects profile without company_name', () => {
    const result = profileSchema.safeParse({
      company_name: '',
      certifications: [],
      naics_codes: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid certification value', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: ['INVALID'],
      naics_codes: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid certification options', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [...CERTIFICATION_OPTIONS],
      naics_codes: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-6-digit NAICS code', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: ['123'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts 6-digit NAICS code', () => {
    const result = profileSchema.safeParse({
      company_name: 'Test',
      certifications: [],
      naics_codes: ['236220'],
    })
    expect(result.success).toBe(true)
  })
})

describe('PROFILE-02: Past Project Validation', () => {
  it('accepts valid past project', () => {
    const result = pastProjectSchema.safeParse({
      contract_number: 'GS-00F-1234',
      agency: 'GSA',
      contract_value: 1500000,
      scope_narrative: 'Building renovation',
      naics_code: '236220',
      outcome: 'Completed on time',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative contract value', () => {
    const result = pastProjectSchema.safeParse({
      contract_value: -100,
    })
    expect(result.success).toBe(false)
  })
})

describe('PROFILE-03: Key Personnel Validation', () => {
  it('accepts valid key personnel with name', () => {
    const result = keyPersonnelSchema.safeParse({
      name: 'John Smith',
      title: 'Project Manager',
      experience: '15 years in federal construction',
      certifications: ['PMP', 'LEED AP'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects key personnel without name', () => {
    const result = keyPersonnelSchema.safeParse({
      name: '',
      title: 'PM',
    })
    expect(result.success).toBe(false)
  })
})
