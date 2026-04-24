import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  piid: z.string().min(1).max(100),
})

interface UsaSpendingAward {
  'Award ID': string
  'Recipient Name': string | null
  'Award Amount': number | null
  'Start Date': string | null
  'End Date': string | null
  'Awarding Agency': string | null
  'Funding Agency': string | null
  'NAICS Code': string | null
  'NAICS Description': string | null
  Description: string | null
}

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ piid: searchParams.get('piid') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing or invalid piid' }, { status: 400 })
  }

  const { piid } = parsed.data

  const body = {
    filters: { award_ids: [piid] },
    fields: [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Start Date',
      'End Date',
      'Awarding Agency',
      'Funding Agency',
      'NAICS Code',
      'NAICS Description',
      'Description',
    ],
    page: 1,
    limit: 5,
    sort: 'Award Amount',
    order: 'desc',
    subawards: false,
  }

  let res: Response
  try {
    res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return NextResponse.json({ error: `USASpending unreachable: ${msg}` }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'USASpending lookup failed' }, { status: 502 })
  }

  const json = await res.json() as { results?: UsaSpendingAward[] }
  const results = json.results ?? []

  if (results.length === 0) {
    return NextResponse.json({ found: false })
  }

  const award = results[0]

  // customer_agency_code has a max length of 50 in the DB schema.
  // USASpending returns full agency names (e.g. "Department of Defense") —
  // truncate rather than reject.
  const rawAgencyCode = award['Awarding Agency'] ?? null
  const customer_agency_code = rawAgencyCode
    ? rawAgencyCode.slice(0, 50)
    : null

  return NextResponse.json({
    found: true,
    data: {
      contract_number: award['Award ID'] ?? piid,
      customer_name: award['Awarding Agency'] ?? award['Funding Agency'] ?? null,
      customer_agency_code,
      contract_value_usd: award['Award Amount'] ?? null,
      period_start: award['Start Date'] ?? null,
      period_end: award['End Date'] ?? null,
      naics_code: award['NAICS Code'] ?? null,
    },
  })
}
