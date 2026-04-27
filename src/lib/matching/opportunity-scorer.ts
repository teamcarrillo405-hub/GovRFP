export interface ScorerProfile {
  certifications: string[]
  naics_codes: string[]
  construction_types: string[]
  geographic_states: string[]
  primary_state?: string | null
  annual_revenue_usd?: number | null
  bonding_single_usd?: number | null
  max_project_size_usd?: number | null
  sba_size_category?: string | null
}

export interface ScorerOpportunity {
  naics_code?: string | null
  set_aside?: string | null
  place_of_performance_state?: string | null
  estimated_value?: number | null
  title?: string | null
}

export interface MatchBreakdown {
  total: number
  naics: number
  set_aside: number
  geography: number
  capacity: number
  construction_type: number
  reasons: string[]
}

// ─── NAICS scoring (0–30) ──────────────────────────────────────────────────

function scoreNaics(profile: ScorerProfile, opp: ScorerOpportunity): { points: number; reason: string | null } {
  const oppCode = opp.naics_code?.trim()

  if (!oppCode) {
    return { points: profile.naics_codes.length === 0 ? 15 : 10, reason: null }
  }

  if (profile.naics_codes.length === 0) {
    return { points: 15, reason: 'No NAICS codes on profile — estimated neutral score' }
  }

  // Exact 6-digit match
  for (const code of profile.naics_codes) {
    if (code === oppCode) {
      return { points: 30, reason: `NAICS ${oppCode} exact match` }
    }
  }

  // 4-digit prefix (industry group) match
  const opp4 = oppCode.substring(0, 4)
  for (const code of profile.naics_codes) {
    if (code.substring(0, 4) === opp4) {
      return { points: 20, reason: `NAICS industry group ${opp4} match` }
    }
  }

  // 2-digit sector match
  const opp2 = oppCode.substring(0, 2)
  for (const code of profile.naics_codes) {
    if (code.substring(0, 2) === opp2) {
      const sectorLabel = opp2 === '23' ? 'construction' : `sector ${opp2}`
      return { points: 10, reason: `NAICS sector ${opp2} match (${sectorLabel})` }
    }
  }

  return { points: 0, reason: `NAICS ${oppCode} — no matching code in your profile` }
}

// ─── Set-aside scoring (0–25) ──────────────────────────────────────────────

const SET_ASIDE_MAP: Record<string, string> = {
  'wosb': 'WOSB',
  'women-owned small business': 'WOSB',
  'women owned small business': 'WOSB',
  'sdvosb': 'SDVOSB',
  'service-disabled': 'SDVOSB',
  'service disabled': 'SDVOSB',
  'service-disabled veteran': 'SDVOSB',
  'service disabled veteran': 'SDVOSB',
  '8(a)': '8(a)',
  '8a': '8(a)',
  'hubzone': 'HUBZone',
  'sdb': 'SDB',
  'small disadvantaged business': 'SDB',
}

const SMALL_BUSINESS_SET_ASIDES = new Set(['WOSB', 'SDVOSB', '8(a)', 'HUBZone', 'SDB'])

function resolveSetAside(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null
  const key = raw.trim().toLowerCase()
  return SET_ASIDE_MAP[key] ?? null
}

function scoreSetAside(
  profile: ScorerProfile,
  opp: ScorerOpportunity,
): { points: number; reason: string | null } {
  const resolved = resolveSetAside(opp.set_aside)

  // Unrestricted or no set-aside
  if (!resolved) {
    // Other-than-small still qualifies for unrestricted
    return { points: 20, reason: 'Unrestricted — open competition' }
  }

  // Small-business set-aside but profile is other_than_small
  if (
    SMALL_BUSINESS_SET_ASIDES.has(resolved) &&
    profile.sba_size_category === 'other_than_small'
  ) {
    return {
      points: 0,
      reason: `${resolved} set-aside — your business is classified other-than-small`,
    }
  }

  // Profile holds the matching cert
  if (profile.certifications.map((c) => c.toLowerCase()).includes(resolved.toLowerCase())) {
    return { points: 25, reason: `${resolved} certified — set-aside eligible` }
  }

  // Set-aside exists but cert not held
  return {
    points: 0,
    reason: `${resolved} set-aside — certification not held`,
  }
}

// ─── Geography scoring (0–20) ──────────────────────────────────────────────

function scoreGeography(
  profile: ScorerProfile,
  opp: ScorerOpportunity,
): { points: number; reason: string | null } {
  const oppState = opp.place_of_performance_state?.trim().toUpperCase() ?? null
  const primaryState = profile.primary_state?.trim().toUpperCase() ?? null
  const geoStates = profile.geographic_states.map((s) => s.trim().toUpperCase())

  if (!oppState) {
    if (!primaryState && geoStates.length === 0) {
      return { points: 10, reason: null }
    }
    return { points: 10, reason: 'No place of performance listed — neutral score' }
  }

  if (!primaryState && geoStates.length === 0) {
    return { points: 10, reason: 'No geographic data in your profile — neutral score' }
  }

  if (primaryState && oppState === primaryState) {
    return { points: 20, reason: `${oppState} — within your primary state` }
  }

  if (geoStates.includes(oppState)) {
    return { points: 15, reason: `${oppState} — within your service geography` }
  }

  return { points: 5, reason: `${oppState} — outside your listed service states` }
}

// ─── Capacity scoring (0–15) ───────────────────────────────────────────────

function formatDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function scoreCapacity(
  profile: ScorerProfile,
  opp: ScorerOpportunity,
): { points: number; reason: string | null } {
  const value = opp.estimated_value ?? null
  const bonding = profile.bonding_single_usd ?? null
  const maxProject = profile.max_project_size_usd ?? null

  if (value === null) {
    return { points: 8, reason: 'No estimated value on opportunity — neutral capacity score' }
  }

  const hasCapacityData = bonding !== null || maxProject !== null

  if (!hasCapacityData) {
    return { points: 8, reason: 'No bonding or capacity data on profile — neutral score' }
  }

  const withinBonding = bonding !== null ? value <= bonding : null
  const withinMax = maxProject !== null ? value <= maxProject : null

  if (withinBonding === true && withinMax === true) {
    return { points: 15, reason: `${formatDollars(value)} within your bonding and project capacity` }
  }

  if (withinBonding === true && withinMax === null) {
    return { points: 12, reason: `${formatDollars(value)} within your single-project bonding limit` }
  }

  if (withinBonding === null && withinMax === true) {
    return { points: 10, reason: `${formatDollars(value)} within your max project size` }
  }

  // Value exceeds bonding (primary constraint)
  if (bonding !== null && value > bonding) {
    return {
      points: 3,
      reason: `Contract value ${formatDollars(value)} may exceed your ${formatDollars(bonding)} single-project bonding limit`,
    }
  }

  // Value exceeds max project size only
  if (maxProject !== null && value > maxProject) {
    return {
      points: 3,
      reason: `Contract value ${formatDollars(value)} may exceed your ${formatDollars(maxProject)} max project size`,
    }
  }

  return { points: 8, reason: null }
}

// ─── Construction type scoring (0–10) ─────────────────────────────────────

const CONSTRUCTION_KEYWORDS: Record<string, string[]> = {
  heavy_civil: ['levee', 'earthwork', 'grading', 'excavation', 'dam', 'dredging', 'flood control'],
  highway: ['highway', 'road', 'bridge', 'pavement', 'interchange', 'transportation'],
  building: ['building', 'facility', 'office', 'hangar', 'warehouse', 'renovation'],
  environmental: ['remediation', 'environmental', 'hazmat', 'contamination', 'cleanup'],
  electrical: ['electrical', 'power', 'substation', 'wiring', 'switchgear'],
  mechanical: ['hvac', 'mechanical', 'plumbing', 'piping', 'chillers'],
}

function scoreConstructionType(
  profile: ScorerProfile,
  opp: ScorerOpportunity,
): { points: number; reason: string | null } {
  if (profile.construction_types.length === 0) {
    return { points: 5, reason: 'No construction types set in your profile — neutral score' }
  }

  const title = opp.title?.toLowerCase() ?? ''

  if (!title) {
    return { points: 5, reason: 'No opportunity title to match construction type' }
  }

  for (const [type, keywords] of Object.entries(CONSTRUCTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (title.includes(kw.toLowerCase())) {
        if (profile.construction_types.includes(type)) {
          return {
            points: 10,
            reason: `Construction type match: ${type.replace('_', ' ')} (keyword: "${kw}")`,
          }
        } else {
          // Keyword found but type not in profile
          return {
            points: 0,
            reason: `Opportunity appears to be ${type.replace('_', ' ')} — not in your construction types`,
          }
        }
      }
    }
  }

  return { points: 5, reason: null }
}

// ─── Main scorer ───────────────────────────────────────────────────────────

export function scoreOpportunity(
  profile: ScorerProfile,
  opp: ScorerOpportunity,
): MatchBreakdown {
  const naicsResult = scoreNaics(profile, opp)
  const setAsideResult = scoreSetAside(profile, opp)
  const geoResult = scoreGeography(profile, opp)
  const capacityResult = scoreCapacity(profile, opp)
  const constructionResult = scoreConstructionType(profile, opp)

  const reasons: string[] = []
  if (naicsResult.reason) reasons.push(naicsResult.reason)
  if (setAsideResult.reason) reasons.push(setAsideResult.reason)
  if (geoResult.reason) reasons.push(geoResult.reason)
  if (capacityResult.reason) reasons.push(capacityResult.reason)
  if (constructionResult.reason) reasons.push(constructionResult.reason)

  const total = Math.round(
    naicsResult.points +
    setAsideResult.points +
    geoResult.points +
    capacityResult.points +
    constructionResult.points,
  )

  return {
    total: Math.min(100, Math.max(0, total)),
    naics: naicsResult.points,
    set_aside: setAsideResult.points,
    geography: geoResult.points,
    capacity: capacityResult.points,
    construction_type: constructionResult.points,
    reasons,
  }
}

// ─── Label thresholds ──────────────────────────────────────────────────────

export function matchLabel(
  score: number,
): 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Low Match' {
  if (score >= 80) return 'Strong Match'
  if (score >= 65) return 'Good Match'
  if (score >= 45) return 'Moderate Match'
  return 'Low Match'
}
