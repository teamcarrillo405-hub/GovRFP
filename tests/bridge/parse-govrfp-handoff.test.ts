import { describe, it, expect } from 'vitest'
import {
  parseGovRfpHandoff,
  govRfpHandoffSchema,
  PARSER_SCOPE_LIMIT,
  type RawGovRfpSearchParams,
} from '@/lib/bridge/govrfp-handoff'

/**
 * ProposalAI receiver half of the bridge contract. The matching sender tests
 * live in contractor-rfp-website/__tests__/lib/bridge.test.ts — they build
 * the URLs that this parser must be able to consume. Keep the fixture
 * synchronized between the two files so schema drift breaks loudly.
 */
const FIXTURE: RawGovRfpSearchParams = {
  source: 'govrfp',
  govrfp_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  solicitation: 'FA8771-26-R-0042',
  title: 'Runway Repair and Maintenance Services',
  agency: 'U.S. Air Force',
  naics: '237310',
  set_aside: 'SDVOSBC',
  deadline: '2026-12-15T17:00:00Z',
  pop_state: 'NM',
  source_url: 'https://sam.gov/opp/ABC123/view',
  scope:
    'The Air Force seeks a qualified SDVOSB contractor to perform runway repair and preventive maintenance at Kirtland AFB.',
}

describe('parseGovRfpHandoff (GovRFP → ProposalAI bridge contract)', () => {
  it('returns the full metadata for a well-formed handoff', () => {
    const out = parseGovRfpHandoff(FIXTURE)
    expect(out).not.toBeNull()
    expect(out!.govrfp_id).toBe(FIXTURE.govrfp_id)
    expect(out!.title).toBe(FIXTURE.title)
    expect(out!.naics).toBe('237310')
    expect(out!.pop_state).toBe('NM')
    expect(out!.source_url).toBe(FIXTURE.source_url)
    expect(out!.scope).toBe(FIXTURE.scope)
  })

  it('minimal valid handoff: source + govrfp_id + title is enough', () => {
    const out = parseGovRfpHandoff({
      source: 'govrfp',
      govrfp_id: FIXTURE.govrfp_id,
      title: FIXTURE.title,
    })
    expect(out).not.toBeNull()
    expect(out!.title).toBe(FIXTURE.title)
    expect(out!.naics).toBeUndefined()
    expect(out!.scope).toBeUndefined()
  })

  it('returns null when source sentinel is missing', () => {
    const { source: _s, ...rest } = FIXTURE
    expect(parseGovRfpHandoff(rest)).toBeNull()
  })

  it('returns null when source sentinel has the wrong value', () => {
    expect(parseGovRfpHandoff({ ...FIXTURE, source: 'direct' })).toBeNull()
  })

  it('returns null when govrfp_id is missing (required-field contract)', () => {
    const { govrfp_id: _g, ...rest } = FIXTURE
    expect(parseGovRfpHandoff(rest)).toBeNull()
  })

  it('returns null when govrfp_id is not a valid UUID', () => {
    expect(parseGovRfpHandoff({ ...FIXTURE, govrfp_id: 'not-a-uuid' })).toBeNull()
  })

  it('returns null when title is missing', () => {
    const { title: _t, ...rest } = FIXTURE
    expect(parseGovRfpHandoff(rest)).toBeNull()
  })

  it('returns null when title is empty string', () => {
    expect(parseGovRfpHandoff({ ...FIXTURE, title: '' })).toBeNull()
  })

  it('silently drops malformed naics (5 digits) rather than rejecting the handoff', () => {
    const out = parseGovRfpHandoff({ ...FIXTURE, naics: '12345' })
    expect(out).not.toBeNull()
    expect(out!.naics).toBeUndefined()
    // Other fields preserved
    expect(out!.title).toBe(FIXTURE.title)
  })

  it('silently drops pop_state that is not exactly 2 chars', () => {
    const out = parseGovRfpHandoff({ ...FIXTURE, pop_state: 'New Mexico' })
    expect(out).not.toBeNull()
    expect(out!.pop_state).toBeUndefined()
  })

  it('silently drops source_url without http(s) scheme', () => {
    const out = parseGovRfpHandoff({ ...FIXTURE, source_url: 'ftp://sam.gov/x' })
    expect(out).not.toBeNull()
    expect(out!.source_url).toBeUndefined()
  })

  it(`accepts scope up to ${PARSER_SCOPE_LIMIT} chars (500-char sender forward-compat slack)`, () => {
    const slackScope = 'A'.repeat(PARSER_SCOPE_LIMIT)
    const out = parseGovRfpHandoff({ ...FIXTURE, scope: slackScope })
    expect(out).not.toBeNull()
    expect(out!.scope).toHaveLength(PARSER_SCOPE_LIMIT)
  })

  it(`returns null when scope exceeds ${PARSER_SCOPE_LIMIT} chars`, () => {
    const tooLong = 'A'.repeat(PARSER_SCOPE_LIMIT + 1)
    expect(parseGovRfpHandoff({ ...FIXTURE, scope: tooLong })).toBeNull()
  })

  it('accepts a 1500-char scope (the sender cap)', () => {
    const senderCap = 'A'.repeat(1500)
    const out = parseGovRfpHandoff({ ...FIXTURE, scope: senderCap })
    expect(out).not.toBeNull()
    expect(out!.scope).toHaveLength(1500)
  })
})

describe('govRfpHandoffSchema (strict server-action validation)', () => {
  it('accepts the sanitized fixture', () => {
    const out = parseGovRfpHandoff(FIXTURE)
    expect(govRfpHandoffSchema.safeParse(out).success).toBe(true)
  })

  it('rejects input where govrfp_id is a non-UUID string', () => {
    const bad = { ...FIXTURE, govrfp_id: 'abc' }
    expect(govRfpHandoffSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects title longer than 200 chars', () => {
    const bad = { govrfp_id: FIXTURE.govrfp_id, title: 'x'.repeat(201) }
    expect(govRfpHandoffSchema.safeParse(bad).success).toBe(false)
  })
})
