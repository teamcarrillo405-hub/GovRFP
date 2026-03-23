import { describe, it, expect } from 'vitest'
import { detectSectionLM } from '@/lib/analysis/section-lm-detector'

describe('detectSectionLM', () => {
  it('detects "SECTION L" from standard UCF heading', () => {
    const text = 'SECTION L — Instructions, Conditions, and Notices to Offerors\n\nL.1 General Instructions'
    const result = detectSectionLM(text)
    expect(result.hasL).toBe(true)
  })

  it('detects "SECTION M" from standard UCF heading', () => {
    const text = 'SECTION M — Evaluation Factors for Award\n\nM.1 Technical Approach'
    const result = detectSectionLM(text)
    expect(result.hasM).toBe(true)
  })

  it('returns hasL: false for non-UCF text (FAR Part 13 solicitation)', () => {
    const text = 'SOLICITATION FOR SIMPLIFIED ACQUISITION\nDelivery: FOB Destination\nPayment terms: Net 30'
    const result = detectSectionLM(text)
    expect(result.hasL).toBe(false)
    expect(result.hasM).toBe(false)
  })

  it('detects Section L from "PROPOSAL PREPARATION INSTRUCTIONS"', () => {
    const text = 'Proposal Preparation Instructions\nOfferors shall prepare proposals in accordance with...'
    const result = detectSectionLM(text)
    expect(result.hasL).toBe(true)
  })

  it('detects Section M from "EVALUATION FACTORS FOR AWARD"', () => {
    const text = 'EVALUATION FACTORS FOR AWARD\nTechnical Approach — 40%\nPast Performance — 30%'
    const result = detectSectionLM(text)
    expect(result.hasM).toBe(true)
  })
})
