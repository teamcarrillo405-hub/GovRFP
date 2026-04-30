import { NextRequest, NextResponse } from 'next/server'

export interface TeamingPartner {
  name: string
  uei?: string
  total_contracts: number
  total_value_millions: number
  naics_codes: string[]
  state: string
  compatibility_score: number
}

interface USASpendingAward {
  recipient_name: string | null
  recipient_uei: string | null
  award_amount: number | null
  naics_code: string | null
  place_of_performance_state_name: string | null
  period_of_performance_start_date: string | null
}

interface USASpendingResponse {
  results: USASpendingAward[]
}

function scorePartner(
  partner: { naics_codes: string[]; state: string; total_value_millions: number },
  naics: string | null,
  state: string | null,
): number {
  let score = 0
  if (naics && partner.naics_codes.includes(naics)) score += 40
  if (state && partner.state && partner.state.toLowerCase() === state.toLowerCase()) score += 30
  score += 20 // has prior federal contracts
  if (partner.total_value_millions >= 1) score += 10
  return Math.min(score, 100)
}

const ABBREV_TO_FULL: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const naics = searchParams.get('naics')
  const state = searchParams.get('state')

  if (!naics) {
    return NextResponse.json({ error: 'naics query param required' }, { status: 400 })
  }

  const body = {
    filters: {
      naics_codes: [naics],
      place_of_performance_scope: 'domestic',
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: '2022-01-01', end_date: '2025-12-31' }],
    },
    fields: [
      'recipient_name', 'recipient_uei', 'Award Amount', 'naics_code',
      'place_of_performance_state_name', 'period_of_performance_start_date',
    ],
    sort: 'Award Amount',
    order: 'desc',
    limit: 100,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    let res: Response
    try {
      res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      console.error('[teaming] USASpending error', res.status, await res.text())
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }

    const json = (await res.json()) as USASpendingResponse
    const awards = json.results ?? []

    const map = new Map<string, {
      name: string; uei?: string; total_contracts: number; total_value: number
      naics_codes: Set<string>; state: string
    }>()

    for (const award of awards) {
      const name = award.recipient_name?.trim() ?? ''
      if (!name) continue
      const key = award.recipient_uei?.trim() || name.toUpperCase()
      const amount = typeof award.award_amount === 'number' ? award.award_amount : 0
      const awardNaics = award.naics_code?.trim() ?? ''
      const awardState = award.place_of_performance_state_name?.trim() ?? ''

      if (map.has(key)) {
        const e = map.get(key)!
        e.total_contracts += 1
        e.total_value += amount
        if (awardNaics) e.naics_codes.add(awardNaics)
        if (!e.state && awardState) e.state = awardState
      } else {
        map.set(key, {
          name, uei: award.recipient_uei?.trim() || undefined,
          total_contracts: 1, total_value: amount,
          naics_codes: new Set(awardNaics ? [awardNaics] : []),
          state: awardState,
        })
      }
    }

    const oppStateFull = state ? (ABBREV_TO_FULL[state.toUpperCase()] ?? state) : null

    const partners: TeamingPartner[] = Array.from(map.values())
      .map((p) => {
        const naics_codes = Array.from(p.naics_codes)
        const total_value_millions = Math.round((p.total_value / 1_000_000) * 10) / 10
        const compatibility_score = scorePartner(
          { naics_codes, state: p.state, total_value_millions },
          naics, oppStateFull,
        )
        const partner: TeamingPartner = {
          name: p.name, total_contracts: p.total_contracts,
          total_value_millions, naics_codes, state: p.state, compatibility_score,
        }
        if (p.uei) partner.uei = p.uei
        return partner
      })
      .sort((a, b) => b.compatibility_score - a.compatibility_score || b.total_value_millions - a.total_value_millions)
      .slice(0, 10)

    return NextResponse.json({ partners }, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'timeout' }, { status: 504 })
    }
    console.error('[teaming] unexpected error', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
