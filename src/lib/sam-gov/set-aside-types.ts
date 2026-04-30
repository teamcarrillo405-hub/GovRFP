export interface SetAsideType {
  code: string
  label: string
  description: string
  category: 'small_business' | 'veteran' | 'disadvantaged' | 'women' | 'historically_underutilized' | 'other'
}

export const SET_ASIDE_TYPES: readonly SetAsideType[] = [
  { code: 'SBA', label: 'Total Small Business', description: 'Total small business set-aside', category: 'small_business' },
  { code: 'SBP', label: 'Partial Small Business', description: 'Partial small business set-aside', category: 'small_business' },
  { code: '8A', label: '8(a) Sole Source', description: '8(a) sole-source procurement under SBA Business Development Program', category: 'disadvantaged' },
  { code: '8AN', label: '8(a) Competed', description: '8(a) competitive set-aside', category: 'disadvantaged' },
  { code: 'HZC', label: 'HUBZone Set-Aside', description: 'Historically Underutilized Business Zone competitive set-aside', category: 'historically_underutilized' },
  { code: 'HZS', label: 'HUBZone Sole Source', description: 'HUBZone sole-source procurement', category: 'historically_underutilized' },
  { code: 'SDVOSBC', label: 'SDVOSB Set-Aside', description: 'Service-Disabled Veteran-Owned Small Business competitive set-aside', category: 'veteran' },
  { code: 'SDVOSBS', label: 'SDVOSB Sole Source', description: 'Service-Disabled Veteran-Owned Small Business sole-source', category: 'veteran' },
  { code: 'VSA', label: 'VOSB Set-Aside', description: 'Veteran-Owned Small Business competitive set-aside', category: 'veteran' },
  { code: 'VSS', label: 'VOSB Sole Source', description: 'Veteran-Owned Small Business sole-source', category: 'veteran' },
  { code: 'WOSB', label: 'WOSB Set-Aside', description: 'Women-Owned Small Business competitive set-aside', category: 'women' },
  { code: 'WOSBSS', label: 'WOSB Sole Source', description: 'Women-Owned Small Business sole-source', category: 'women' },
  { code: 'EDWOSB', label: 'EDWOSB Set-Aside', description: 'Economically Disadvantaged Women-Owned Small Business competitive set-aside', category: 'women' },
  { code: 'EDWOSBSS', label: 'EDWOSB Sole Source', description: 'Economically Disadvantaged WOSB sole-source', category: 'women' },
  { code: 'LAS', label: 'Local Area Set-Aside', description: 'Local area set-aside (e.g., for disaster recovery zones)', category: 'other' },
  { code: 'IEE', label: 'Indian Economic Enterprise', description: 'Indian Economic Enterprise set-aside under Buy Indian Act', category: 'other' },
  { code: 'ISBEE', label: 'Indian Small Business', description: 'Indian Small Business Economic Enterprise set-aside', category: 'other' },
  { code: 'BICiv', label: 'BIA Civilian', description: 'Buy Indian Act civilian set-aside', category: 'other' },
] as const

const BY_CODE = new Map(SET_ASIDE_TYPES.map((t) => [t.code, t]))

export function lookupSetAside(code: string | null | undefined): SetAsideType | null {
  if (!code) return null
  return BY_CODE.get(code.trim()) ?? null
}

export function setAsideLabel(code: string | null | undefined, fallback?: string): string {
  if (!code) return fallback ?? '—'
  return BY_CODE.get(code.trim())?.label ?? fallback ?? code
}

export const SET_ASIDE_CODES: readonly string[] = SET_ASIDE_TYPES.map((t) => t.code)

export const SET_ASIDE_OPTIONS: ReadonlyArray<{ code: string; label: string }> = (() => {
  const seen = new Set<string>()
  const out: { code: string; label: string }[] = []
  for (const t of SET_ASIDE_TYPES) {
    const baseCode = t.code.replace(/(SS|S|N)$/i, '').replace(/^8AN$/, '8A')
    if (seen.has(baseCode)) continue
    seen.add(baseCode)
    const labels: Record<string, string> = {
      SBA: 'SBA — Small Business',
      '8A': '8(a) — Small Disadvantaged Business',
      HZC: 'HUBZONE — Historically Underutilized Business Zone',
      SDVOSBC: 'SDVOSB — Service-Disabled Veteran-Owned Small Business',
      VSA: 'VOSB — Veteran-Owned Small Business',
      WOSB: 'WOSB — Women-Owned Small Business',
      EDWOSB: 'EDWOSB — Economically Disadvantaged WOSB',
      LAS: 'Local Area Set-Aside',
      IEE: 'Indian Economic Enterprise',
      ISBEE: 'Indian Small Business Economic Enterprise',
      BICiv: 'Buy Indian Act Civilian',
    }
    if (labels[baseCode]) out.push({ code: baseCode, label: labels[baseCode] })
  }
  return out
})()
