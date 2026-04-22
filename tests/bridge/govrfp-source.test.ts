import { describe, it, expect } from 'vitest'
import {
  extractGovRfpSource,
  buildGovRfpOpportunityUrl,
  DEFAULT_GOVRFP_URL,
} from '@/lib/bridge/govrfp-source'

/**
 * Return-trip unit tests — read win_factors metadata + build a back-link URL
 * to the source opportunity on GovRFP.
 */

const GOOD_WIN_FACTORS = {
  govrfp_handoff: true,
  govrfp_opportunity_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  solicitation_number: 'FA8771-26-R-0042',
  agency: 'U.S. Air Force',
}

describe('extractGovRfpSource', () => {
  it('returns the opportunity id when the handoff flag is set', () => {
    const out = extractGovRfpSource(GOOD_WIN_FACTORS)
    expect(out).not.toBeNull()
    expect(out!.opportunityId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
  })

  it('returns null when win_factors is null', () => {
    expect(extractGovRfpSource(null)).toBeNull()
  })

  it('returns null when win_factors is undefined', () => {
    expect(extractGovRfpSource(undefined)).toBeNull()
  })

  it('returns null when win_factors is not an object (string)', () => {
    expect(extractGovRfpSource('not-an-object')).toBeNull()
  })

  it('returns null when the handoff flag is missing', () => {
    const { govrfp_handoff: _f, ...rest } = GOOD_WIN_FACTORS
    expect(extractGovRfpSource(rest)).toBeNull()
  })

  it('returns null when the handoff flag is false', () => {
    expect(extractGovRfpSource({ ...GOOD_WIN_FACTORS, govrfp_handoff: false })).toBeNull()
  })

  it('returns null when the opportunity id is missing', () => {
    const { govrfp_opportunity_id: _id, ...rest } = GOOD_WIN_FACTORS
    expect(extractGovRfpSource(rest)).toBeNull()
  })

  it('returns null when the opportunity id is an empty string', () => {
    expect(extractGovRfpSource({ ...GOOD_WIN_FACTORS, govrfp_opportunity_id: '' })).toBeNull()
  })

  it('returns null when the opportunity id is a non-string', () => {
    expect(extractGovRfpSource({ ...GOOD_WIN_FACTORS, govrfp_opportunity_id: 42 })).toBeNull()
  })

  it('returns null when given the ANALYZE-03 WinFactors shape (no govrfp flag)', () => {
    const analyzeShape = {
      scope_alignment: { score: 82, rationale: '...' },
      certifications_match: 100,
      set_aside_match: 100,
      past_performance_relevance: { score: 60, rationale: '...' },
      competition_level: { score: 70, rationale: '...' },
    }
    expect(extractGovRfpSource(analyzeShape)).toBeNull()
  })
})

describe('buildGovRfpOpportunityUrl', () => {
  it('builds the URL against the default GovRFP host', () => {
    const url = buildGovRfpOpportunityUrl('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    expect(url).toBe(`${DEFAULT_GOVRFP_URL}/opportunities/f47ac10b-58cc-4372-a567-0e02b2c3d479`)
  })

  it('accepts a custom base URL', () => {
    const url = buildGovRfpOpportunityUrl('abc', 'https://govrfp.hcc.gov')
    expect(url).toBe('https://govrfp.hcc.gov/opportunities/abc')
  })

  it('strips trailing slashes from the base URL to avoid //opportunities/', () => {
    const url = buildGovRfpOpportunityUrl('abc', 'https://govrfp.hcc.gov/')
    expect(url).toBe('https://govrfp.hcc.gov/opportunities/abc')
  })

  it('strips multiple trailing slashes', () => {
    const url = buildGovRfpOpportunityUrl('abc', 'https://govrfp.hcc.gov///')
    expect(url).toBe('https://govrfp.hcc.gov/opportunities/abc')
  })

  it('produces a well-formed URL when parsed', () => {
    const out = new URL(buildGovRfpOpportunityUrl('abc'))
    expect(out.pathname).toBe('/opportunities/abc')
    expect(out.origin).toBe(DEFAULT_GOVRFP_URL)
  })
})
