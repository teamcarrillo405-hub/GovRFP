import { describe, it, expect } from 'vitest'
import { computeCertificationsScore, computeSetAsideScore, computeWinScore } from '@/lib/analysis/win-score'
import type { WinFactors } from '@/lib/analysis/types'

describe('computeCertificationsScore', () => {
  it('returns 90 when contractor cert matches RFP set-aside', () => {
    expect(computeCertificationsScore(['8(a)', 'SDB'], ['8(a)'])).toBe(90)
  })

  it('returns 20 when contractor cert does not match RFP set-aside', () => {
    expect(computeCertificationsScore(['SDB'], ['HUBZone'])).toBe(20)
  })

  it('returns 50 when RFP has no set-aside preference', () => {
    expect(computeCertificationsScore(['8(a)'], [])).toBe(50)
  })
})

describe('computeSetAsideScore', () => {
  it('returns 100 when contractor is eligible for the set-aside', () => {
    expect(computeSetAsideScore(['8(a)', 'SDB'], '8(a)')).toBe(100)
  })

  it('returns 0 when contractor is not eligible for the set-aside', () => {
    expect(computeSetAsideScore(['SDB'], 'HUBZone')).toBe(0)
  })

  it('returns 50 when RFP has no set-aside requirement', () => {
    expect(computeSetAsideScore(['8(a)'], null)).toBe(50)
  })
})

describe('computeWinScore', () => {
  it('computes weighted average from all 5 factors correctly', () => {
    const factors: WinFactors = {
      scope_alignment: { score: 90, reasoning: 'Strong match' },
      certifications_match: 50,
      set_aside_match: 100,
      past_performance_relevance: { score: 70, reasoning: 'Relevant projects' },
      competition_level: { score: 60, reasoning: 'Moderate competition' },
    }
    // 90*0.30 + 50*0.25 + 100*0.20 + 70*0.15 + 60*0.10
    // = 27 + 12.5 + 20 + 10.5 + 6 = 76
    expect(computeWinScore(factors)).toBe(76)
  })

  it('clamps output to 0-100 range', () => {
    const factors: WinFactors = {
      scope_alignment: { score: 100, reasoning: '' },
      certifications_match: 100,
      set_aside_match: 100,
      past_performance_relevance: { score: 100, reasoning: '' },
      competition_level: { score: 100, reasoning: '' },
    }
    expect(computeWinScore(factors)).toBeLessThanOrEqual(100)
    expect(computeWinScore(factors)).toBeGreaterThanOrEqual(0)
  })
})
