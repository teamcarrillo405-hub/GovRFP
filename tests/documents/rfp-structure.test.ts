import { describe, it, expect } from 'vitest'
import { extractRfpStructure } from '@/lib/documents/rfp-structure'

const SAMPLE_RFP_TEXT = `
SECTION C - DESCRIPTION/SPECIFICATIONS/STATEMENT OF WORK

1.0 Scope of Work
The contractor shall provide all necessary personnel, materials, and equipment.

1.1 General Requirements
The contractor must comply with all applicable federal regulations.
All work will be performed in accordance with industry standards.

2.0 Technical Approach
The offeror should describe their proposed technical approach.

SECTION L - INSTRUCTIONS TO OFFERORS

L.1 Proposal Format
Proposals shall be submitted in two volumes.
The contractor must include past performance references.
`

describe('rfp-structure', () => {
  it('extractRfpStructure() finds numbered sections', () => {
    const result = extractRfpStructure(SAMPLE_RFP_TEXT)
    expect(result.sections.length).toBeGreaterThanOrEqual(2)
    const numbers = result.sections.map(s => s.number)
    expect(numbers).toContain('C')
  })

  it('extractRfpStructure() extracts shall/must requirements', () => {
    const result = extractRfpStructure(SAMPLE_RFP_TEXT)
    expect(result.requirements.length).toBeGreaterThanOrEqual(3)
    const types = result.requirements.map(r => r.type)
    expect(types).toContain('shall')
    expect(types).toContain('must')
  })

  it('extractRfpStructure() classifies requirement types correctly', () => {
    const result = extractRfpStructure(SAMPLE_RFP_TEXT)
    const shallReqs = result.requirements.filter(r => r.type === 'shall')
    expect(shallReqs.length).toBeGreaterThanOrEqual(1)
    expect(shallReqs[0].text).toMatch(/shall/i)
  })

  it('extractRfpStructure() returns empty arrays for plain text with no structure', () => {
    const result = extractRfpStructure('This is just a paragraph with no structure.')
    expect(result.sections).toHaveLength(0)
    expect(result.requirements).toHaveLength(0)
  })

  it('extractRfpStructure() handles Section L/M style numbering', () => {
    const result = extractRfpStructure(SAMPLE_RFP_TEXT)
    const sectionNumbers = result.sections.map(s => s.number)
    expect(sectionNumbers).toContain('L')
  })

  it('extractRfpStructure() extracts will requirement type', () => {
    const result = extractRfpStructure(SAMPLE_RFP_TEXT)
    const willReqs = result.requirements.filter(r => r.type === 'will')
    expect(willReqs.length).toBeGreaterThanOrEqual(1)
  })
})
