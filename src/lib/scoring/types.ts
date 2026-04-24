import type { SectionLMEntry, AnalysisRequirement } from '@/lib/analysis/types'
import type { SectionName } from '@/lib/editor/types'

/** One criterion in the scoring matrix with its weight (0-1) */
export interface ScoringCriterion {
  ref: string           // e.g. "M.3.1"
  label: string         // e.g. "Technical Approach"
  weight: number        // 0-1, sums to 1.0 across all criteria for a section
  description: string   // what the evaluator is looking for
}

/** Scoring matrix for one proposal — built from the L/M crosswalk */
export interface ScoringMatrix {
  proposal_id: string
  source: 'section_lm' | 'default'  // did we get real L/M or fall back?
  criteria: ScoringCriterion[]
  /** Pre-filtered requirements per section for quick lookup */
  requirements_by_section: Record<SectionName, AnalysisRequirement[]>
}

/** Per-criterion score returned by Claude */
export interface CriterionScore {
  ref: string
  label: string
  score: number       // 0-100 for this criterion
  weight: number
  weighted: number    // score * weight
  rationale: string
  gaps: string[]
}

/** Full score result for one section draft */
export interface SectionScoreResult {
  section: SectionName
  attempt: number
  total_score: number    // weighted composite 0-100
  passed: boolean        // total_score >= PASS_THRESHOLD
  criteria: CriterionScore[]
  critique: string       // overall critique — becomes the next draft's instruction
  strengths: string[]
  gaps: string[]
}

/** SSE event emitted during the watchdog loop */
export type WatchdogEvent =
  | { type: 'watchdog_status'; message: string; attempt: number }
  | { type: 'watchdog_score'; score: number; passed: boolean; attempt: number; critique: string }
  | { type: 'watchdog_approved'; score: number; attempt: number; content: string }
  | { type: 'watchdog_failed'; attempts: number; last_score: number; content: string }

/** Threshold for passing — 90/100 */
export const PASS_THRESHOLD = 90

/** Max auto-redraft attempts before releasing best effort */
export const MAX_ATTEMPTS = 3

/**
 * Default scoring criteria used when the RFP has no Section M.
 * Weights sum to 1.0.
 */
export const DEFAULT_CRITERIA: Omit<ScoringCriterion, 'ref'>[] = [
  {
    label: 'Requirements Coverage',
    weight: 0.35,
    description: 'All mandatory RFP requirements (shall/must) are explicitly addressed',
  },
  {
    label: 'Technical Accuracy',
    weight: 0.25,
    description: 'Content is factually accurate and technically sound for the stated scope',
  },
  {
    label: 'Compliance Language',
    weight: 0.20,
    description: 'Proposal commitments mirror RFP mandatory language; no shall/must requirements omitted',
  },
  {
    label: 'Specificity and Evidence',
    weight: 0.15,
    description: 'Claims are supported by specific examples, metrics, or past performance references',
  },
  {
    label: 'Clarity and Organization',
    weight: 0.05,
    description: 'Section is well-structured, free of jargon, and directly addresses the evaluation criteria',
  },
]

export function buildDefaultCriteria(): ScoringCriterion[] {
  return DEFAULT_CRITERIA.map((c, i) => ({ ...c, ref: `DEFAULT-${i + 1}` }))
}

/** Parse an L/M weight string to a 0-1 float */
export function parseWeight(raw: string): number {
  // "40%", "300 points", "300 pts", "0.4", "40"
  const percentMatch = raw.match(/([\d.]+)\s*%/)
  if (percentMatch) return parseFloat(percentMatch[1]) / 100

  const pointsMatch = raw.match(/([\d.]+)\s*(?:points?|pts?)/i)
  if (pointsMatch) return parseFloat(pointsMatch[1])  // caller normalizes

  const numMatch = raw.match(/([\d.]+)/)
  if (numMatch) return parseFloat(numMatch[1]) / 100

  return 0
}

/** Normalize a set of raw weights so they sum to 1.0 */
export function normalizeWeights(raw: number[]): number[] {
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum === 0) return raw.map(() => 1 / raw.length)
  return raw.map((w) => w / sum)
}

/**
 * Build a ScoringMatrix for a proposal from its L/M crosswalk.
 * Falls back to DEFAULT_CRITERIA if crosswalk is empty.
 */
export function buildScoringMatrix(
  proposalId: string,
  crosswalk: SectionLMEntry[],
  requirements: AnalysisRequirement[],
): ScoringMatrix {
  const reqsBySection = groupRequirementsBySection(requirements)

  if (!crosswalk.length) {
    return {
      proposal_id: proposalId,
      source: 'default',
      criteria: buildDefaultCriteria(),
      requirements_by_section: reqsBySection,
    }
  }

  const rawWeights = crosswalk.map((e) => parseWeight(e.weight))
  const normalized = normalizeWeights(rawWeights)

  const criteria: ScoringCriterion[] = crosswalk.map((entry, i) => ({
    ref: entry.section_m_ref,
    label: entry.section_m_criterion,
    weight: normalized[i],
    description: `${entry.section_l_instruction} — evaluated as: ${entry.section_m_criterion}`,
  }))

  return {
    proposal_id: proposalId,
    source: 'section_lm',
    criteria,
    requirements_by_section: reqsBySection,
  }
}

function groupRequirementsBySection(
  requirements: AnalysisRequirement[],
): Record<SectionName, AnalysisRequirement[]> {
  const SECTION_TOPIC_MAP: Record<string, SectionName> = {
    Technical: 'Technical Approach',
    Management: 'Management Plan',
    'Past Performance': 'Executive Summary',
    Price: 'Project Schedule',
    Certifications: 'Cover Letter',
    Deliverables: 'Technical Approach',
    Other: 'Executive Summary',
  }

  const groups: Record<SectionName, AnalysisRequirement[]> = {
    'Cover Letter': [],
    'Executive Summary': [],
    'Technical Approach': [],
    'Management Plan': [],
    'Staffing Plan': [],
    'Quality Control Plan': [],
    'Safety Plan': [],
    'Project Schedule': [],
  }

  for (const req of requirements) {
    const section = SECTION_TOPIC_MAP[req.proposal_topic] ?? 'Executive Summary'
    groups[section].push(req)
  }

  return groups
}
