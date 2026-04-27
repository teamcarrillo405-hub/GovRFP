import type { SamGovApiResponse } from './types'

const BASE_URL = 'https://api.sam.gov/opportunities/v2/search'

// Most common federal construction NAICS codes (6-digit for exact matching)
export const CONSTRUCTION_NAICS_CODES = [
  '236220', // Commercial/Institutional Building Construction
  '236210', // Industrial Building Construction
  '237110', // Water Supply Line Construction
  '237310', // Highway, Street, and Bridge Construction
  '237990', // Other Heavy/Civil Engineering Construction
  '238110', // Poured Concrete Foundation
  '238120', // Structural Steel/Precast Concrete
  '238160', // Roofing Contractors
  '238190', // Other Foundation/Structure/Building Exterior
  '238210', // Electrical Contractors
  '238220', // Plumbing/Heating/Air-Conditioning
  '238290', // Other Building Equipment
  '238310', // Drywall/Insulation
  '238320', // Painting/Wall Covering
  '238910', // Site Preparation
  '238990', // All Other Specialty Trade
]

function mmddyyyy(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}/${d}/${date.getFullYear()}`
}

export async function fetchSamGovOpportunities(
  apiKey: string,
  naicsCode: string,
  limit = 100,
  offset = 0,
  daysBack = 90,
): Promise<SamGovApiResponse> {
  const now = new Date()
  const from = new Date(now.getTime() - daysBack * 86400 * 1000)

  const params = new URLSearchParams({
    api_key: apiKey,
    ptype: 'o,p,k',
    ncode: naicsCode,
    limit: String(Math.min(limit, 1000)),
    offset: String(offset),
    postedFrom: mmddyyyy(from),
    postedTo: mmddyyyy(now),
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
  maxPerNaics = 200,
): Promise<SamGovApiResponse['opportunitiesData']> {
  const all: SamGovApiResponse['opportunitiesData'] = []
  const seenIds = new Set<string>()

  for (const naics of CONSTRUCTION_NAICS_CODES) {
    let offset = 0
    const pageSize = Math.min(maxPerNaics, 100)
    const maxPages = Math.ceil(maxPerNaics / pageSize)

    for (let page = 0; page < maxPages; page++) {
      try {
        const resp = await fetchSamGovOpportunities(apiKey, naics, pageSize, offset)
        const batch = resp.opportunitiesData ?? []
        for (const opp of batch) {
          if (!seenIds.has(opp.noticeId)) {
            seenIds.add(opp.noticeId)
            all.push(opp)
          }
        }
        if (batch.length < pageSize) break
        offset += pageSize
      } catch (err) {
        console.error(`[sam-gov] Error fetching NAICS ${naics}:`, err)
        break
      }
    }
  }

  return all
}
