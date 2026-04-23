/**
 * Question Engine — types and constants.
 *
 * Hybrid design (locked decision): templated core + Claude-generated.
 * Templated questions live in code (question-bank.ts) keyed by work-type
 * and category. Generative questions land per-RFP from the API.
 */

export const QUESTION_CATEGORIES = [
  'past_performance',
  'cost',
  'schedule',
  'compliance',
  'differentiation',
  'risk',
  'scope',
  'personnel',
] as const

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  past_performance: 'Past Performance',
  cost: 'Cost & Pricing',
  schedule: 'Schedule',
  compliance: 'Compliance',
  differentiation: 'Differentiation',
  risk: 'Risk',
  scope: 'Scope',
  personnel: 'Key Personnel',
}

export const WORK_TYPES = ['construction', 'it', 'services', 'r_and_d'] as const
export type WorkType = (typeof WORK_TYPES)[number]

/** A templated question definition (lives in code) */
export interface TemplateQuestion {
  /** stable key, e.g. "construction.scope.start_date" — used as template_key in DB */
  key: string
  workTypes: WorkType[]
  category: QuestionCategory
  question: string
  context?: string
  required?: boolean
}

/** A row from question_session_items */
export interface QuestionSessionItem {
  id: string
  session_id: string
  position: number
  source: 'template' | 'generative'
  template_key: string | null
  category: QuestionCategory
  question: string
  context: string | null
  required: boolean
  answer: string | null
  answered_at: string | null
  created_at: string
}

/** A row from question_sessions, with eager-loaded items */
export interface QuestionSession {
  id: string
  proposal_id: string
  user_id: string
  team_id: string | null
  status: 'in_progress' | 'complete' | 'abandoned'
  created_at: string
  updated_at: string
  items: QuestionSessionItem[]
}

/**
 * Detect work type from NAICS code prefix. Heuristic only — Claude can
 * override or refine on the generative pass.
 */
export function detectWorkType(naics: string | null | undefined): WorkType {
  if (!naics || naics.length < 2) return 'services'
  const prefix2 = naics.slice(0, 2)
  // NAICS sectors: 23 = Construction, 54 = Professional/IT/R&D, 51 = Info, 56 = Admin Services
  if (prefix2 === '23') return 'construction'
  if (prefix2 === '54') {
    // 5417xx = Scientific R&D, 5415xx = Computer Systems Design (IT)
    if (naics.startsWith('5417')) return 'r_and_d'
    if (naics.startsWith('5415')) return 'it'
    return 'services'
  }
  if (prefix2 === '51') return 'it'
  return 'services'
}
