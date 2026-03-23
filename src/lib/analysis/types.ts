/** ANALYZE-01: Extracted requirement from RFP */
export interface AnalysisRequirement {
  id: string                  // REQ-001, REQ-002...
  text: string                // Verbatim text
  classification: 'mandatory' | 'desired'
  keyword: 'shall' | 'must' | 'will' | 'should' | 'may'
  section_ref: string
  page_hint?: string
  proposal_topic: 'Technical' | 'Management' | 'Past Performance' | 'Price' | 'Certifications' | 'Deliverables' | 'Other'
}

/** ANALYZE-02: One row in the compliance matrix */
export interface ComplianceMatrixRow {
  requirement_id: string
  proposal_section: 'Executive Summary' | 'Technical Approach' | 'Management Plan' | 'Past Performance' | 'Price Narrative' | 'Cover Letter' | 'Other'
  coverage_status: 'addressed' | 'unaddressed' | 'partial'
  rationale: string
}

/** ANALYZE-03: Detail for a single win factor */
export interface WinFactorDetail {
  score: number               // 0-100
  reasoning: string
  gaps?: string[]
  matching_projects?: string[]
  indicators?: string[]
}

/** ANALYZE-03: All 5 win probability factors */
export interface WinFactors {
  scope_alignment: WinFactorDetail
  certifications_match: number  // Computed locally -- just a score (0-100)
  set_aside_match: number       // Computed locally -- 0 or 100
  past_performance_relevance: WinFactorDetail
  competition_level: WinFactorDetail
}

/** ANALYZE-04: Set-aside detection flag */
export interface SetAsideFlag {
  program: string
  detected_in_rfp: boolean
  contractor_eligible: boolean
  is_match: boolean
}

/** ANALYZE-05: Section L/M crosswalk entry */
export interface SectionLMEntry {
  section_l_ref: string
  section_l_instruction: string
  section_m_ref: string
  section_m_criterion: string
  weight: string
}

/** Full analysis result (mirrors rfp_analysis table) */
export interface RfpAnalysis {
  id: string
  proposal_id: string
  requirements: AnalysisRequirement[]
  compliance_matrix: ComplianceMatrixRow[]
  win_score: number
  win_factors: WinFactors
  set_asides_detected: string[]
  set_aside_flags: SetAsideFlag[]
  section_lm_crosswalk: SectionLMEntry[]
  has_section_l: boolean
  has_section_m: boolean
  crosswalk_note?: string
  analyzed_at: string
  model_used: string
  tokens_input?: number
  tokens_output?: number
  tokens_cached?: number
}

/** Score weights for win probability calculation */
export const WIN_SCORE_WEIGHTS = {
  scope_alignment: 0.30,
  certifications_match: 0.25,
  set_aside_match: 0.20,
  past_performance_relevance: 0.15,
  competition_level: 0.10,
} as const
