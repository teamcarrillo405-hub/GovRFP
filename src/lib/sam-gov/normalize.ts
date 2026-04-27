import type { SamGovOpportunity, NormalizedOpportunity } from './types'

const SET_ASIDE_MAP: Record<string, string> = {
  'Total Small Business Set-Aside': 'SB',
  'Small Business': 'SB',
  '8(a) Set-Aside': '8(a)',
  '8(A)': '8(a)',
  'HUBZone Set-Aside': 'HUBZone',
  'HUBZone': 'HUBZone',
  'Service-Disabled Veteran-Owned Small Business': 'SDVOSB',
  'SDVOSB': 'SDVOSB',
  'Women-Owned Small Business': 'WOSB',
  'WOSB': 'WOSB',
  'Economically Disadvantaged Women-Owned Small Business': 'EDWOSB',
  'Unrestricted': 'Unrestricted',
}

function parseValueRange(low?: number, high?: number): number | null {
  if (low != null && high != null) return Math.round((low + high) / 2) * 100
  if (low != null) return low * 100
  if (high != null) return high * 100
  return null
}

export function normalize(raw: SamGovOpportunity): NormalizedOpportunity {
  const agencyParts = raw.fullParentPathName?.split('.')
  const agency = agencyParts?.[0]?.trim() ?? raw.organizationName ?? null
  const office = agencyParts?.[1]?.trim() ?? null

  const rawSetAside = raw.typeOfSetAsideDescription ?? ''
  const set_aside = SET_ASIDE_MAP[rawSetAside] ?? (rawSetAside || null)

  return {
    solicitation_number: raw.solicitationNumber ?? null,
    notice_id: raw.noticeId,
    title: raw.title,
    agency,
    office,
    naics_code: raw.naicsCode ?? null,
    set_aside,
    place_of_performance_state: raw.placeOfPerformance?.state?.code ?? null,
    place_of_performance_city: raw.placeOfPerformance?.city?.name ?? null,
    estimated_value: parseValueRange(raw.estimatedValueLow, raw.estimatedValueHigh),
    posted_date: raw.postedDate ?? null,
    due_date: raw.responseDeadLine ?? null,
    active: true,
    sam_url: raw.link ?? null,
    description: raw.description ?? null,
    match_score: null,
  }
}
