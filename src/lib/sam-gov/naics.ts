export interface NaicsCode {
  code: string
  label: string
  trade: 'Building' | 'Heavy' | 'Highway' | 'Residential' | 'Specialty' | 'Design' | 'Services'
}

export const NAICS_CODES: readonly NaicsCode[] = [
  // 236 — Construction of Buildings
  { code: '236115', label: 'New Single-Family Housing Construction', trade: 'Residential' },
  { code: '236116', label: 'New Multifamily Housing Construction', trade: 'Residential' },
  { code: '236117', label: 'New Housing For-Sale Builders', trade: 'Residential' },
  { code: '236118', label: 'Residential Remodelers', trade: 'Residential' },
  { code: '236210', label: 'Industrial Building Construction', trade: 'Building' },
  { code: '236220', label: 'Commercial & Institutional Building Construction', trade: 'Building' },

  // 237 — Heavy and Civil Engineering
  { code: '237110', label: 'Water & Sewer Line Construction', trade: 'Heavy' },
  { code: '237120', label: 'Oil & Gas Pipeline Construction', trade: 'Heavy' },
  { code: '237130', label: 'Power & Communication Line Construction', trade: 'Heavy' },
  { code: '237210', label: 'Land Subdivision', trade: 'Heavy' },
  { code: '237310', label: 'Highway, Street, & Bridge Construction', trade: 'Highway' },
  { code: '237990', label: 'Other Heavy & Civil Engineering Construction', trade: 'Heavy' },

  // 238 — Specialty Trade Contractors
  { code: '238110', label: 'Poured Concrete Foundation Contractors', trade: 'Specialty' },
  { code: '238120', label: 'Structural Steel & Precast Concrete', trade: 'Specialty' },
  { code: '238130', label: 'Framing Contractors', trade: 'Specialty' },
  { code: '238140', label: 'Masonry Contractors', trade: 'Specialty' },
  { code: '238150', label: 'Glass & Glazing Contractors', trade: 'Specialty' },
  { code: '238160', label: 'Roofing Contractors', trade: 'Specialty' },
  { code: '238170', label: 'Siding Contractors', trade: 'Specialty' },
  { code: '238190', label: 'Other Foundation, Structure, & Building Exterior', trade: 'Specialty' },
  { code: '238210', label: 'Electrical Contractors', trade: 'Specialty' },
  { code: '238220', label: 'Plumbing, Heating, & Air-Conditioning', trade: 'Specialty' },
  { code: '238290', label: 'Other Building Equipment Contractors', trade: 'Specialty' },
  { code: '238310', label: 'Drywall & Insulation Contractors', trade: 'Specialty' },
  { code: '238320', label: 'Painting & Wall Covering Contractors', trade: 'Specialty' },
  { code: '238330', label: 'Flooring Contractors', trade: 'Specialty' },
  { code: '238340', label: 'Tile & Terrazzo Contractors', trade: 'Specialty' },
  { code: '238350', label: 'Finish Carpentry Contractors', trade: 'Specialty' },
  { code: '238390', label: 'Other Building Finishing Contractors', trade: 'Specialty' },
  { code: '238910', label: 'Site Preparation Contractors', trade: 'Specialty' },
  { code: '238990', label: 'All Other Specialty Trade Contractors', trade: 'Specialty' },

  // 541 — Design services
  { code: '541310', label: 'Architectural Services', trade: 'Design' },
  { code: '541320', label: 'Landscape Architectural Services', trade: 'Design' },
  { code: '541330', label: 'Engineering Services', trade: 'Design' },
  { code: '541350', label: 'Building Inspection Services', trade: 'Design' },
  { code: '541370', label: 'Surveying & Mapping Services', trade: 'Design' },

  // 561 — Services
  { code: '561730', label: 'Landscaping Services', trade: 'Services' },
] as const

const BY_CODE = new Map(NAICS_CODES.map((n) => [n.code, n]))

export function lookupNaics(code: string | null | undefined): NaicsCode | null {
  if (!code) return null
  return BY_CODE.get(code.trim()) ?? null
}

export function naicsLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const found = BY_CODE.get(code.trim())
  return found ? `${found.code} — ${found.label}` : code
}

export const NAICS_OPTIONS: ReadonlyArray<{ code: string; label: string }> = NAICS_CODES.map(
  (n) => ({ code: n.code, label: `${n.code} — ${n.label}` }),
)
