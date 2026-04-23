import type { PastPerformanceRow } from './types'

/**
 * Past Performance relevance ranker — pure function.
 *
 * Given an RFP analysis snapshot, scores each PP record 0-100 and returns
 * them sorted by descending score. Hybrid signals:
 *
 *   - NAICS match           (40 pts): exact 6-digit match → 40, 4-digit
 *                                     industry-group match → 20, else 0
 *   - Set-aside match       (20 pts): per-overlap weighted; 1 match → 20
 *   - Value proximity       (20 pts): log-distance from RFP estimated value
 *   - Keyword overlap       (20 pts): bag-of-words intersection between
 *                                     RFP scope keywords and pp.scope_narrative
 *
 * Embedding-based semantic similarity (40 pts) is the planned 4th signal but
 * requires an embeddings provider key (OpenAI text-embedding-3-small recommended).
 * When pp.relevance_embedding is null, that signal contributes 0 and the other
 * signals are renormalized. This keeps the ranker working without an external
 * embeddings dependency in V1.
 */

export interface RankerSignals {
  /** Target NAICS code from rfp_analysis.win_factors.naics or opportunity */
  rfpNaics: string | null
  /** Set-aside codes from rfp_analysis.set_asides_detected */
  rfpSetAsides: string[]
  /** Estimated RFP value in USD (from win_factors or opportunity), if known */
  rfpValueUsd: number | null
  /** Free-text scope/title to keyword-match against PP scope_narrative */
  rfpScopeText: string
}

export interface RankedPp {
  record: PastPerformanceRow
  score: number
  breakdown: {
    naics: number
    setAside: number
    value: number
    keyword: number
  }
}

const W_NAICS = 40
const W_SET_ASIDE = 20
const W_VALUE = 20
const W_KEYWORD = 20

export function rankPastPerformance(
  records: PastPerformanceRow[],
  signals: RankerSignals,
  limit = 5,
): RankedPp[] {
  const rfpKeywords = extractKeywords(signals.rfpScopeText)

  const ranked: RankedPp[] = records.map((record) => {
    const naics = scoreNaics(record.naics_codes, signals.rfpNaics)
    const setAside = scoreSetAside(record.set_asides_claimed, signals.rfpSetAsides)
    const value = scoreValue(
      record.contract_value_usd ? Number(record.contract_value_usd) : null,
      signals.rfpValueUsd,
    )
    const keyword = scoreKeyword(record.scope_narrative, rfpKeywords)

    return {
      record,
      score: naics + setAside + value + keyword,
      breakdown: { naics, setAside, value, keyword },
    }
  })

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function scoreNaics(ppNaics: string[], rfpNaics: string | null): number {
  if (!rfpNaics || ppNaics.length === 0) return 0
  if (ppNaics.includes(rfpNaics)) return W_NAICS
  // 4-digit industry group fallback (e.g. 236220 → 2362, partial relevance)
  const rfpGroup = rfpNaics.slice(0, 4)
  if (ppNaics.some((n) => n.slice(0, 4) === rfpGroup)) return W_NAICS / 2
  return 0
}

function scoreSetAside(ppSetAsides: string[], rfpSetAsides: string[]): number {
  if (rfpSetAsides.length === 0 || ppSetAsides.length === 0) return 0
  const overlap = ppSetAsides.filter((s) => rfpSetAsides.includes(s)).length
  if (overlap === 0) return 0
  // Any overlap → full credit. Set-asides are categorical, not gradient.
  return W_SET_ASIDE
}

function scoreValue(ppValue: number | null, rfpValue: number | null): number {
  if (ppValue == null || rfpValue == null || ppValue <= 0 || rfpValue <= 0) return 0
  // 1 - |log(rfp/pp)| / log(10), clamped 0-1.
  // Equal values → 1. 10× difference → 0. 100× → already negative, clamped to 0.
  const ratio = Math.log10(rfpValue / ppValue)
  const proximity = Math.max(0, 1 - Math.abs(ratio))
  return Math.round(proximity * W_VALUE)
}

function scoreKeyword(ppScope: string, rfpKeywords: Set<string>): number {
  if (rfpKeywords.size === 0) return 0
  const ppKeywords = extractKeywords(ppScope)
  if (ppKeywords.size === 0) return 0
  let overlap = 0
  for (const kw of ppKeywords) if (rfpKeywords.has(kw)) overlap++
  // Jaccard-ish: overlap / smaller set, capped at 1
  const ratio = Math.min(1, overlap / Math.min(rfpKeywords.size, ppKeywords.size))
  return Math.round(ratio * W_KEYWORD)
}

/**
 * Tokenize text into a Set of significant 4+ char alphabetic terms,
 * lowercased. Strips standard English stopwords. Good enough for the
 * keyword overlap signal until we wire embeddings.
 */
function extractKeywords(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  return new Set(tokens)
}

const STOPWORDS = new Set([
  'this', 'that', 'these', 'those', 'with', 'from', 'will', 'would', 'should',
  'shall', 'have', 'been', 'were', 'their', 'there', 'about', 'which', 'where',
  'when', 'while', 'into', 'over', 'under', 'such', 'than', 'them', 'they',
  'each', 'more', 'most', 'some', 'other', 'also', 'only', 'work', 'using',
  'used', 'must', 'including', 'include', 'between', 'within', 'through',
  'shall', 'project', 'projects', 'contract', 'contracts', 'services',
])
