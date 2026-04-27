import type { SamGovApiResponse } from './types'

const BASE_URL = 'https://api.sam.gov/opportunities/v2/search'

// NAICS codes for federal construction: 236, 237, 238 ranges
const CONSTRUCTION_NAICS = ['236', '237', '238']

export async function fetchSamGovOpportunities(
  apiKey: string,
  naicsPrefix: string,
  limit = 100,
  offset = 0,
): Promise<SamGovApiResponse> {
  const params = new URLSearchParams({
    api_key: apiKey,
    ptype: 'o,p,k',   // solicitation, presolicitation, combined
    ncode: naicsPrefix,
    limit: String(limit),
    offset: String(offset),
    active: 'Yes',
  })

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`SAM.gov API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<SamGovApiResponse>
}

export async function fetchAllConstructionOpportunities(
  apiKey: string,
): Promise<SamGovApiResponse['opportunitiesData']> {
  const all: SamGovApiResponse['opportunitiesData'] = []

  for (const prefix of CONSTRUCTION_NAICS) {
    let offset = 0
    const pageSize = 100
    // max 500 per NAICS prefix to stay well within rate limits
    for (let page = 0; page < 5; page++) {
      const resp = await fetchSamGovOpportunities(apiKey, prefix, pageSize, offset)
      all.push(...(resp.opportunitiesData ?? []))
      if (all.length >= resp.totalRecords || (resp.opportunitiesData?.length ?? 0) < pageSize) break
      offset += pageSize
    }
  }

  return all
}
