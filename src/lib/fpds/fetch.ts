import type { FpdsAward, FpdsSearchResult } from './types'

interface UsaSpendingAwardResult {
  'Award ID'?: string
  'Recipient Name'?: string
  'Award Amount'?: number | null
  'Award Date'?: string | null
  'awarding_agency_name'?: string | null
  'Description'?: string | null
  'Period of Performance Current End Date'?: string | null
  'Contract Award Type'?: string | null
  'NAICS Code'?: string | null
  internal_id?: string | null
  recipient_uei?: string | null
}

interface UsaSpendingResponse {
  results?: UsaSpendingAwardResult[]
  page_metadata?: {
    total: number
  }
}

export async function fetchFpdsAwardsByAgency(
  agencyName: string,
  naicsCode: string | null,
  limit = 10,
): Promise<FpdsSearchResult> {
  const EMPTY: FpdsSearchResult = { awards: [], totalCount: 0, source: 'fpds' }

  if (!agencyName) return EMPTY

  try {
    const filters: Record<string, unknown> = {
      award_type_codes: ['A', 'B', 'C', 'D'],
      agencies: [{ type: 'awarding', tier: 'toptier', name: agencyName }],
    }

    if (naicsCode) {
      filters.naics_codes = [naicsCode]
    }

    const body = {
      filters,
      fields: [
        'Award ID',
        'Recipient Name',
        'Award Amount',
        'Award Date',
        'awarding_agency_name',
        'Description',
        'Period of Performance Current End Date',
        'Contract Award Type',
        'NAICS Code',
      ],
      sort: 'Award Date',
      order: 'desc',
      limit,
      page: 1,
    }

    const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      next: { revalidate: 3600 }, // cache for 1 hour
    })

    if (!res.ok) return EMPTY

    const json = (await res.json()) as UsaSpendingResponse
    const results = json.results ?? []

    const awards: FpdsAward[] = results.map((r, i): FpdsAward => ({
      awardId: r['Award ID'] ?? `fpds-${i}`,
      contractId: r.internal_id ?? r['Award ID'] ?? `fpds-${i}`,
      agencyName: r.awarding_agency_name ?? agencyName,
      awardeeUei: r.recipient_uei ?? '',
      awardeeName: r['Recipient Name'] ?? 'Unknown',
      awardAmount: r['Award Amount'] ?? 0,
      awardDate: r['Award Date'] ?? '',
      completionDate: r['Period of Performance Current End Date'] ?? '',
      description: r.Description ?? '',
      naicsCode: r['NAICS Code'] ?? naicsCode ?? '',
      setAside: null,
      solicitationId: null,
      placeOfPerformanceState: null,
      isIncumbent: i === 0, // most recent award recipient flagged as potential incumbent
    }))

    return {
      awards,
      totalCount: json.page_metadata?.total ?? awards.length,
      source: 'fpds',
    }
  } catch {
    return EMPTY
  }
}
