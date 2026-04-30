import { NextRequest, NextResponse } from 'next/server'

export interface Competitor {
  name: string
  uei: string | null
  total_value_millions: number
  total_contracts: number
  naics_codes: string[]
  agencies: string[]
  states: string[]
  latest_award: string | null
  sam_url: string
}

interface USASpendingAward {
  recipient_name: string | null
  recipient_uei: string | null
  'Award Amount': number | null
  naics_code: string | null
  place_of_performance_state_name: string | null
  awarding_agency_name: string | null
  period_of_performance_start_date: string | null
  description: string | null
}

interface USASpendingResponse {
  results: USASpendingAward[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const naics = searchParams.get('naics')
  const agency = searchParams.get('agency')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10

  if (!naics) {
    return NextResponse.json({ error: 'naics query param required' }, { status: 400 })
  }

  const filters: Record<string, unknown> = {
    naics_codes: [naics],
    place_of_performance_scope: 'domestic',
    award_type_codes: ['A', 'B', 'C', 'D'],
    time_period: [{ start_date: '2021-01-01', end_date: '2025-12-31' }],
  }

  if (agency) {
    filters.awarding_agencies = [{ type: 'awarding_agency', toptier_name: agency }]
  }

  const body = {
    filters,
    fields: [
      'recipient_name', 'recipient_uei', 'Award Amount', 'naics_code',
      'place_of_performance_state_name', 'awarding_agency_name',
      'period_of_performance_start_date', 'description',
    ],
    sort: 'Award Amount',
    order: 'desc',
    limit: 200,
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
      console.error('[competitors] USASpending error', res.status, await res.text())
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }

    const json = (await res.json()) as USASpendingResponse
    const awards = json.results ?? []

    const map = new Map<string, {
      name: string; uei: string | null; total_value: number; total_contracts: number
      naics_codes: Set<string>; agencies: Set<string>; states: Set<string>; latest_award: string | null
    }>()

    for (const award of awards) {
      const name = award.recipient_name?.trim() ?? ''
      if (!name) continue
      const key = name.toUpperCase()
      const amount = typeof award['Award Amount'] === 'number' ? award['Award Amount'] : 0
      const awardDate = award.period_of_performance_start_date ?? null

      if (map.has(key)) {
        const e = map.get(key)!
        e.total_contracts += 1
        e.total_value += amount
        if (award.naics_code?.trim()) e.naics_codes.add(award.naics_code.trim())
        if (award.place_of_performance_state_name?.trim()) e.states.add(award.place_of_performance_state_name.trim())
        if (award.awarding_agency_name?.trim()) e.agencies.add(award.awarding_agency_name.trim())
        if (awardDate && (!e.latest_award || awardDate > e.latest_award)) e.latest_award = awardDate
      } else {
        map.set(key, {
          name, uei: award.recipient_uei?.trim() || null,
          total_contracts: 1, total_value: amount,
          naics_codes: new Set(award.naics_code?.trim() ? [award.naics_code.trim()] : []),
          agencies: new Set(award.awarding_agency_name?.trim() ? [award.awarding_agency_name.trim()] : []),
          states: new Set(award.place_of_performance_state_name?.trim() ? [award.place_of_performance_state_name.trim()] : []),
          latest_award: awardDate,
        })
      }
    }

    const competitors: Competitor[] = Array.from(map.values())
      .map((c) => ({
        name: c.name, uei: c.uei,
        total_value_millions: Math.round((c.total_value / 1_000_000) * 10) / 10,
        total_contracts: c.total_contracts,
        naics_codes: Array.from(c.naics_codes),
        agencies: Array.from(c.agencies).slice(0, 3),
        states: Array.from(c.states).slice(0, 3),
        latest_award: c.latest_award,
        sam_url: `https://sam.gov/search/?keywords=${encodeURIComponent(c.name)}`,
      }))
      .sort((a, b) => b.total_value_millions - a.total_value_millions)
      .slice(0, limit)

    return NextResponse.json({ competitors }, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'USASpending timeout' }, { status: 504 })
    }
    console.error('[competitors] unexpected error', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
