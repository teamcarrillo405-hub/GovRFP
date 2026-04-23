import type { TemplateQuestion, WorkType, QuestionCategory } from './types'

/**
 * Templated question bank (hybrid design — anchors the experience with
 * 10-15 standard questions; Claude adds 10-20 RFP-specific ones at runtime).
 *
 * Organized by category for filtering. Each question's `workTypes` array
 * is checked against the detected work type for the current proposal.
 *
 * Keep questions evergreen (no specific RFP refs) and answerable in 2-3
 * sentences. The user's answers feed into LLM section-drafting prompts.
 */

export const QUESTION_BANK: TemplateQuestion[] = [
  // ── SCOPE ──
  {
    key: 'common.scope.firm_understanding',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'scope',
    question:
      'In one paragraph, what is YOUR understanding of the work — in plain language, beyond the RFP wording?',
    context:
      'Demonstrating "we get it" early is a top scoring driver. Avoid restating the RFP verbatim.',
    required: true,
  },

  // ── PAST PERFORMANCE ──
  {
    key: 'common.pp.top_three',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'past_performance',
    question:
      'Which 3–5 prior contracts in your library most closely match this RFP\u2019s scope, value, and customer type?',
    context:
      'The Past Performance ranker can suggest these — review the Library sidebar in the editor for top matches.',
    required: true,
  },
  {
    key: 'common.pp.lessons_learned',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'past_performance',
    question:
      'What\u2019s one lesson learned from a similar prior contract you would apply to THIS engagement?',
  },

  // ── DIFFERENTIATION ──
  {
    key: 'common.diff.top_three',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'differentiation',
    question:
      'List your top 3 discriminators against likely competitors for this opportunity. (Why us, not them?)',
    context:
      'Capture should drive ALL section narratives. Specific is better than generic ("ISO 27001 certified" beats "high quality").',
    required: true,
  },

  // ── COST ──
  {
    key: 'construction.cost.bonding_confirmed',
    workTypes: ['construction'],
    category: 'cost',
    question:
      'Confirmed: bonding capacity covers the estimated contract value (single + aggregate)?',
  },
  {
    key: 'common.cost.target_margin',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'cost',
    question: 'What is your target gross margin range for this bid? (Internal only — informs strategy.)',
  },
  {
    key: 'common.cost.subcontractor_share',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'cost',
    question: 'Estimated subcontractor share of total contract value (%).',
  },

  // ── SCHEDULE ──
  {
    key: 'common.schedule.start_date',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'schedule',
    question: 'Realistic earliest start date if awarded (assume contract execution + 30 days).',
    required: true,
  },
  {
    key: 'common.schedule.critical_path',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'schedule',
    question: 'Top 3 critical-path tasks and their durations.',
  },

  // ── COMPLIANCE ──
  {
    key: 'common.compliance.clearance_required',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'compliance',
    question:
      'Does this RFP require facility or personnel security clearances? If yes, do you currently meet them?',
  },
  {
    key: 'common.compliance.cybersecurity',
    workTypes: ['it', 'services', 'r_and_d'],
    category: 'compliance',
    question: 'CMMC level or other cybersecurity attestation required? Do you currently hold it?',
  },
  {
    key: 'construction.compliance.davis_bacon',
    workTypes: ['construction'],
    category: 'compliance',
    question:
      'Davis-Bacon prevailing wages apply (federal construction). Wage determination identified and priced?',
    context: 'GovRFP\u2019s prevailing-wage module can pull WD rates by county and trade.',
  },

  // ── PERSONNEL ──
  {
    key: 'common.personnel.pm_named',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'personnel',
    question:
      'Named Project Manager: who, with what authority, reachable for the proposal-period and execution?',
    required: true,
  },
  {
    key: 'common.personnel.key_named',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'personnel',
    question: 'Other Key Personnel required by Section L: are all positions filled with named individuals?',
  },

  // ── RISK ──
  {
    key: 'common.risk.top_one',
    workTypes: ['construction', 'it', 'services', 'r_and_d'],
    category: 'risk',
    question:
      'What\u2019s the #1 delivery risk you see, and your specific mitigation?',
    context:
      'Surface it BEFORE evaluators ask. Unaddressed risks read as ignorance; named risks with mitigations read as competence.',
  },
]

/**
 * Filter the bank to questions matching a given work type, ordered by
 * category for stable presentation.
 */
export function getTemplatedQuestionsForWorkType(workType: WorkType): TemplateQuestion[] {
  return QUESTION_BANK.filter((q) => q.workTypes.includes(workType)).sort((a, b) =>
    CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category],
  )
}

const CATEGORY_ORDER: Record<QuestionCategory, number> = {
  scope: 1,
  past_performance: 2,
  differentiation: 3,
  cost: 4,
  schedule: 5,
  personnel: 6,
  compliance: 7,
  risk: 8,
}
