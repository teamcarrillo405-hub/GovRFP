import type { WinFactors } from './types'
import { WIN_SCORE_WEIGHTS } from './types'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function computeCertificationsScore(
  contractorCerts: string[],
  rfpSetAsides: string[]
): number {
  if (rfpSetAsides.length === 0) return 50
  const certSet = new Set(contractorCerts.map(normalize))
  const matches = rfpSetAsides.filter(sa => certSet.has(normalize(sa)))
  return matches.length > 0 ? 90 : 20
}

export function computeSetAsideScore(
  contractorCerts: string[],
  rfpPrimarySetAside: string | null
): number {
  if (!rfpPrimarySetAside) return 50
  const certSet = new Set(contractorCerts.map(normalize))
  return certSet.has(normalize(rfpPrimarySetAside)) ? 100 : 0
}

export function computeWinScore(factors: WinFactors): number {
  const raw =
    factors.scope_alignment.score * WIN_SCORE_WEIGHTS.scope_alignment +
    factors.certifications_match * WIN_SCORE_WEIGHTS.certifications_match +
    factors.set_aside_match * WIN_SCORE_WEIGHTS.set_aside_match +
    factors.past_performance_relevance.score * WIN_SCORE_WEIGHTS.past_performance_relevance +
    factors.competition_level.score * WIN_SCORE_WEIGHTS.competition_level
  return Math.min(100, Math.max(0, Math.round(raw)))
}
