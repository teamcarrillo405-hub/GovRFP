import type Anthropic from '@anthropic-ai/sdk'
import type { PastPerformanceRow } from './types'
import type { AnalysisRequirement } from '@/lib/analysis/types'

type SystemBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: 'ephemeral' }
}

/**
 * Build the system prompt array for tailoring a single Past Performance
 * record into a Section L-aligned narrative for the current proposal.
 *
 * The first block is small and per-PP (record metadata + draft instructions).
 * The second block is the LARGE shared context (RFP analysis + Section L
 * instructions + Section M criteria) marked with cache_control: ephemeral.
 *
 * Across multiple PP narratives drafted for the same proposal, the second
 * block hits Claude's prompt cache (5-min TTL), reducing token cost by
 * 60-80% per subsequent draft.
 */
export function buildTailorPrompt(
  pp: PastPerformanceRow,
  rfpAnalysis: {
    requirements: AnalysisRequirement[]
    section_lm_crosswalk?: Array<{
      section_l_ref: string
      section_l_instruction: string
      section_m_ref: string
      section_m_criterion: string
      weight: string
    }>
    win_factors?: Record<string, unknown>
  },
  proposalTitle: string,
): { system: SystemBlock[]; userMessage: string } {
  const ppMeta = formatPpRecord(pp)

  const system: SystemBlock[] = [
    {
      type: 'text',
      text: `You are an expert federal proposal writer with deep FAR 15.305 past-performance experience. Draft a tailored Past Performance narrative based on the source record below, mapped explicitly to the current RFP's Section L instructions and Section M evaluation criteria.

SOURCE RECORD (evergreen facts — do not invent):
${ppMeta}

DRAFT REQUIREMENTS:
- 200-350 words, single narrative paragraph or 2-3 short paragraphs
- Lead with the most evaluator-relevant fact (highest dollar value, most NAICS-aligned scope, or strongest CPARS rating)
- Cite specific Section M evaluation criteria where applicable
- Use active voice, past tense, third person ("XYZ Construction completed...")
- Surface measurable outcomes (cost savings, schedule, awards) when present in source
- Do NOT invent dates, dollar values, or outcomes not in the source record
- Match the formal tone of FAR-based federal procurement
- Output Markdown only — no preamble, no commentary, no headers unless present in source`,
    },
    {
      type: 'text',
      text: `CURRENT RFP CONTEXT — "${proposalTitle}"

Requirements (extracted by analyzer):
${(rfpAnalysis.requirements ?? []).slice(0, 30).map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : JSON.stringify(r)}`).join('\n')}

Section L/M crosswalk:
${(rfpAnalysis.section_lm_crosswalk ?? []).map((c) => `- L ${c.section_l_ref}: ${c.section_l_instruction}\n  → M ${c.section_m_ref}: ${c.section_m_criterion} (weight: ${c.weight})`).join('\n') || '(no crosswalk extracted)'}

Win factors / opportunity metadata:
${JSON.stringify(rfpAnalysis.win_factors ?? {}, null, 2)}`,
      cache_control: { type: 'ephemeral' },
    },
  ]

  return {
    system,
    userMessage: `Draft the tailored Past Performance narrative for this contract now. Output Markdown only.`,
  }
}

function formatPpRecord(pp: PastPerformanceRow): string {
  const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—')
  const fmtUsd = (v: number | null | undefined) =>
    v != null ? `$${Number(v).toLocaleString()}` : '—'
  const personnel = Array.isArray(pp.key_personnel)
    ? pp.key_personnel
        .map((p: { name?: string; role?: string; still_with_firm?: boolean }) =>
          `${p.name} (${p.role}${p.still_with_firm === false ? ', no longer with firm' : ''})`,
        )
        .join('; ')
    : ''

  return `Title: ${pp.contract_title}
Contract #: ${pp.contract_number ?? '—'}
Customer: ${pp.customer_name}${pp.customer_agency_code ? ` [${pp.customer_agency_code}]` : ''}
Period: ${fmtDate(pp.period_start)} to ${fmtDate(pp.period_end)}
Value: ${fmtUsd(pp.contract_value_usd ? Number(pp.contract_value_usd) : null)}
NAICS: ${pp.naics_codes?.join(', ') || '—'}
Set-asides claimed: ${pp.set_asides_claimed?.join(', ') || '—'}
CPARS rating: ${pp.cpars_rating ?? '—'}
Tags: ${pp.tags?.join(', ') || '—'}

Scope (evergreen):
${pp.scope_narrative}

Outcomes:
${pp.outcomes ?? '—'}

Key personnel: ${personnel || '—'}`
}
