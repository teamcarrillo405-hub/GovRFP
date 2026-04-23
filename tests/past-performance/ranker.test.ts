import { describe, it, expect } from 'vitest'
import { rankPastPerformance } from '@/lib/past-performance/ranker'
import type { PastPerformanceRow } from '@/lib/past-performance/types'

function makeRecord(overrides: Partial<PastPerformanceRow>): PastPerformanceRow {
  return {
    id: crypto.randomUUID(),
    user_id: '00000000-0000-0000-0000-000000000001',
    team_id: null,
    contract_title: 'Generic',
    contract_number: null,
    customer_name: 'Generic Customer',
    customer_agency_code: null,
    customer_poc_name: null,
    customer_poc_email: null,
    period_start: null,
    period_end: null,
    contract_value_usd: null,
    naics_codes: [],
    set_asides_claimed: [],
    scope_narrative: 'placeholder scope text',
    key_personnel: [],
    outcomes: null,
    cpars_rating: null,
    tags: [],
    relevance_embedding: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('rankPastPerformance', () => {
  it('returns empty when no records', () => {
    const out = rankPastPerformance([], {
      rfpNaics: '236220', rfpSetAsides: [], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(out).toEqual([])
  })

  it('exact NAICS match scores 40', () => {
    const rec = makeRecord({ naics_codes: ['236220'] })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: '236220', rfpSetAsides: [], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(breakdown.naics).toBe(40)
  })

  it('industry-group NAICS match scores 20 (partial credit)', () => {
    const rec = makeRecord({ naics_codes: ['236210'] }) // same 2362xx group
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: '236220', rfpSetAsides: [], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(breakdown.naics).toBe(20)
  })

  it('unrelated NAICS scores 0', () => {
    const rec = makeRecord({ naics_codes: ['541330'] })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: '236220', rfpSetAsides: [], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(breakdown.naics).toBe(0)
  })

  it('any set-aside overlap scores 20', () => {
    const rec = makeRecord({ set_asides_claimed: ['SDVOSBC', 'WOSB'] })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null, rfpSetAsides: ['SDVOSBC'], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(breakdown.setAside).toBe(20)
  })

  it('no set-aside overlap scores 0', () => {
    const rec = makeRecord({ set_asides_claimed: ['WOSB'] })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null, rfpSetAsides: ['SDVOSBC'], rfpValueUsd: null, rfpScopeText: '',
    })
    expect(breakdown.setAside).toBe(0)
  })

  it('exact value match scores 20', () => {
    const rec = makeRecord({ contract_value_usd: 1_000_000 })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null, rfpSetAsides: [], rfpValueUsd: 1_000_000, rfpScopeText: '',
    })
    expect(breakdown.value).toBe(20)
  })

  it('10x value difference scores 0', () => {
    const rec = makeRecord({ contract_value_usd: 100_000 })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null, rfpSetAsides: [], rfpValueUsd: 1_000_000, rfpScopeText: '',
    })
    expect(breakdown.value).toBe(0)
  })

  it('roughly equivalent value scores positive', () => {
    const rec = makeRecord({ contract_value_usd: 800_000 })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null, rfpSetAsides: [], rfpValueUsd: 1_000_000, rfpScopeText: '',
    })
    expect(breakdown.value).toBeGreaterThan(15)
    expect(breakdown.value).toBeLessThan(20)
  })

  it('keyword overlap scores up to 20', () => {
    const rec = makeRecord({
      scope_narrative:
        'Design-build construction renovation barracks military housing operations',
    })
    const [{ breakdown }] = rankPastPerformance([rec], {
      rfpNaics: null,
      rfpSetAsides: [],
      rfpValueUsd: null,
      rfpScopeText: 'Construction renovation military housing barracks design',
    })
    expect(breakdown.keyword).toBeGreaterThan(0)
    expect(breakdown.keyword).toBeLessThanOrEqual(20)
  })

  it('full-signal best-case totals 100', () => {
    const rec = makeRecord({
      naics_codes: ['236220'],
      set_asides_claimed: ['SDVOSBC'],
      contract_value_usd: 1_000_000,
      scope_narrative: 'design-build renovation construction barracks',
    })
    const [{ score }] = rankPastPerformance([rec], {
      rfpNaics: '236220',
      rfpSetAsides: ['SDVOSBC'],
      rfpValueUsd: 1_000_000,
      rfpScopeText: 'design-build renovation construction barracks',
    })
    expect(score).toBe(100)
  })

  it('sorts by descending score and respects limit', () => {
    const records = [
      makeRecord({ contract_title: 'low', naics_codes: ['541330'] }),
      makeRecord({ contract_title: 'mid', naics_codes: ['236210'] }),
      makeRecord({ contract_title: 'high', naics_codes: ['236220'] }),
      makeRecord({ contract_title: 'extra', naics_codes: ['541330'] }),
    ]
    const out = rankPastPerformance(records, {
      rfpNaics: '236220', rfpSetAsides: [], rfpValueUsd: null, rfpScopeText: '',
    }, 3)
    expect(out).toHaveLength(3)
    expect(out[0].record.contract_title).toBe('high')
    expect(out[1].record.contract_title).toBe('mid')
  })

  it('handles missing/null fields without crashing', () => {
    const rec = makeRecord({ naics_codes: [], contract_value_usd: null, scope_narrative: '' })
    expect(() =>
      rankPastPerformance([rec], {
        rfpNaics: null,
        rfpSetAsides: [],
        rfpValueUsd: null,
        rfpScopeText: '',
      }),
    ).not.toThrow()
  })
})
