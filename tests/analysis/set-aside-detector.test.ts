import { describe, it, expect } from 'vitest'
import { detectSetAsides, detectPrimarySetAside, generateSetAsideFlags } from '@/lib/analysis/set-aside-detector'

describe('detectSetAsides', () => {
  it('detects 8(a) from standard FAR language', () => {
    const text = 'This procurement is set aside for 8(a) small business concerns under FAR 19.8.'
    expect(detectSetAsides(text)).toContain('8(a)')
  })

  it('detects HUBZone from "historically underutilized business zone"', () => {
    const text = 'Award shall be made to a Historically Underutilized Business Zone (HUBZone) concern.'
    expect(detectSetAsides(text)).toContain('HUBZone')
  })

  it('detects SDVOSB from "service-disabled veteran-owned"', () => {
    const text = 'This requirement is set aside for Service-Disabled Veteran-Owned Small Business (SDVOSB) concerns.'
    expect(detectSetAsides(text)).toContain('SDVOSB')
  })

  it('detects WOSB from "women-owned small business"', () => {
    const text = 'Set aside for Women-Owned Small Business (WOSB) under FAR 19.15.'
    expect(detectSetAsides(text)).toContain('WOSB')
  })

  it('detects SDB from "small disadvantaged business"', () => {
    const text = 'Preference given to Small Disadvantaged Business concerns.'
    expect(detectSetAsides(text)).toContain('SDB')
  })

  it('returns empty array when no set-aside language present', () => {
    const text = 'This is a full and open competition with no set-aside restrictions.'
    const result = detectSetAsides(text)
    expect(result).not.toContain('8(a)')
    expect(result).not.toContain('HUBZone')
    expect(result).not.toContain('SDVOSB')
  })

  it('detects primary set-aside from FAR 52.219-27 clause number (SDVOSB)', () => {
    const text = 'FAR clause 52.219-27 applies. Service-disabled veteran-owned concerns only.'
    expect(detectPrimarySetAside(text)).toBe('SDVOSB')
  })
})

describe('generateSetAsideFlags', () => {
  it('marks 8(a) as matching when contractor has 8(a) cert', () => {
    const text = 'This is an 8(a) set-aside procurement.'
    const flags = generateSetAsideFlags(text, ['8(a)', 'SDB'])
    const flag = flags.find(f => f.program === '8(a)')
    expect(flag?.is_match).toBe(true)
    expect(flag?.contractor_eligible).toBe(true)
  })

  it('marks HUBZone as not matching when contractor lacks HUBZone cert', () => {
    const text = 'HUBZone set-aside applies under FAR 19.13.'
    const flags = generateSetAsideFlags(text, ['8(a)', 'SDB'])
    const flag = flags.find(f => f.program === 'HUBZone')
    expect(flag?.is_match).toBe(false)
    expect(flag?.contractor_eligible).toBe(false)
  })

  it('is case-insensitive in certification comparison', () => {
    const text = 'SDVOSB set-aside.'
    const flags = generateSetAsideFlags(text, ['sdvosb'])
    const flag = flags.find(f => f.program === 'SDVOSB')
    expect(flag?.is_match).toBe(true)
  })
})
