import type { SetAsideFlag } from './types'

const SET_ASIDE_PATTERNS: Record<string, RegExp> = {
  '8(a)':    /\b8\s*\(a\)(?!\w)|\b8a\s+(?:set[-\s]aside|program|contract|small\s+business)\b/i,
  'HUBZone': /\bhubzone\b|\bhistorically\s+underutilized\s+business\s+zone\b/i,
  'SDVOSB':  /\bsdvosb\b|\bservice[-\s]disabled\s+veteran[-\s]owned\s+small\s+business\b/i,
  'VOSB':    /\bvosb\b|\bveteran[-\s]owned\s+small\s+business\b/i,
  'WOSB':    /\bwosb\b|\bwomen[-\s]owned\s+small\s+business\b/i,
  'EDWOSB':  /\bedwosb\b|\beconomically\s+disadvantaged\s+women[-\s]owned\b/i,
  'SDB':     /\bsdb\b|\bsmall\s+disadvantaged\s+business\b/i,
  'SBSA':    /\bsmall\s+business\s+set[-\s]aside\b|\btotal\s+small\s+business\b/i,
}

const FAR_CLAUSE_MAP: Record<string, string> = {
  '52.219-14': 'SBSA',
  '52.219-3':  'HUBZone',
  '52.219-27': 'SDVOSB',
  '52.219-29': 'EDWOSB',
  '52.219-30': 'WOSB',
}

export function detectSetAsides(rfpText: string): string[] {
  return Object.entries(SET_ASIDE_PATTERNS)
    .filter(([, pattern]) => pattern.test(rfpText))
    .map(([name]) => name)
}

export function detectPrimarySetAside(rfpText: string): string | null {
  for (const [clause, type] of Object.entries(FAR_CLAUSE_MAP)) {
    if (new RegExp(clause.replace('.', '\\.')).test(rfpText)) return type
  }
  return detectSetAsides(rfpText)[0] ?? null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function generateSetAsideFlags(
  rfpText: string,
  contractorCerts: string[]
): SetAsideFlag[] {
  const detected = detectSetAsides(rfpText)
  const certSet = new Set(contractorCerts.map(normalize))
  return detected.map(program => ({
    program,
    detected_in_rfp: true,
    contractor_eligible: certSet.has(normalize(program)),
    is_match: certSet.has(normalize(program)),
  }))
}
