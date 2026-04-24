import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import type { SectionLMEntry } from '@/lib/analysis/types'
import { buildScoringMatrix, parseWeight, normalizeWeights } from '@/lib/scoring/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const maxDuration = 120

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RedTeamCriterionScore {
  criterion: string
  weight: number        // 0–1 normalized
  weight_display: string // e.g. "30%" or raw from RFP
  score: number         // 0–100
  verdict: 'Outstanding' | 'Good' | 'Acceptable' | 'Marginal' | 'Unacceptable'
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  recommended_edits: string[]
}

export interface RedTeamResult {
  overall_score: number
  overall_verdict: 'outstanding' | 'good' | 'acceptable' | 'marginal' | 'unacceptable'
  summary: string
  criteria_scores: RedTeamCriterionScore[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictFromScore(score: number): RedTeamCriterionScore['verdict'] {
  if (score >= 90) return 'Outstanding'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Acceptable'
  if (score >= 35) return 'Marginal'
  return 'Unacceptable'
}

function overallVerdictKey(
  score: number,
): RedTeamResult['overall_verdict'] {
  if (score >= 90) return 'outstanding'
  if (score >= 75) return 'good'
  if (score >= 55) return 'acceptable'
  if (score >= 35) return 'marginal'
  return 'unacceptable'
}

/**
 * Build the evaluation criteria list for the prompt.
 * Prefers real Section M crosswalk entries; falls back to default criteria.
 */
function buildEvalCriteria(
  crosswalk: SectionLMEntry[],
): { criterion: string; ref: string; weight: number; weight_display: string }[] {
  if (crosswalk.length > 0) {
    const rawWeights = crosswalk.map((e) => parseWeight(e.weight))
    const normalized = normalizeWeights(rawWeights)
    return crosswalk.map((entry, i) => ({
      ref: entry.section_m_ref,
      criterion: entry.section_m_criterion,
      weight: normalized[i],
      weight_display: entry.weight,
    }))
  }

  // Default fallback — mirrors buildDefaultCriteria() logic
  return [
    { ref: 'DEFAULT-1', criterion: 'Technical Approach', weight: 0.35, weight_display: '35%' },
    { ref: 'DEFAULT-2', criterion: 'Management Plan', weight: 0.25, weight_display: '25%' },
    { ref: 'DEFAULT-3', criterion: 'Past Performance', weight: 0.20, weight_display: '20%' },
    { ref: 'DEFAULT-4', criterion: 'Price / Cost Reasonableness', weight: 0.15, weight_display: '15%' },
    { ref: 'DEFAULT-5', criterion: 'Small Business Utilization', weight: 0.05, weight_display: '5%' },
  ]
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'viewer')
  if (!roleResult) return new Response('Forbidden', { status: 403 })

  // ── Load all context ──────────────────────────────────────────────────────
  const [proposalRes, analysisRes, sectionsRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('title, rfp_text')
      .eq('id', proposalId)
      .single(),
    supabase
      .from('rfp_analysis')
      .select('section_lm_crosswalk, requirements, has_section_m, crosswalk_note')
      .eq('proposal_id', proposalId)
      .maybeSingle(),
    supabase
      .from('proposal_sections')
      .select('section_name, content')
      .eq('proposal_id', proposalId)
      .not('content', 'is', null),
  ])

  if (!proposalRes.data) return new Response('Proposal not found', { status: 404 })

  const crosswalk = (analysisRes.data?.section_lm_crosswalk ?? []) as SectionLMEntry[]
  const hasSectionM = analysisRes.data?.has_section_m ?? false
  const sections = sectionsRes.data ?? []

  if (sections.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No drafted sections found. Draft your proposal sections first.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Build criteria block ──────────────────────────────────────────────────
  const evalCriteria = buildEvalCriteria(crosswalk)

  const criteriaBlock = evalCriteria
    .map(
      (c) =>
        `• [${c.ref}] ${c.criterion} — Weight: ${c.weight_display} (${Math.round(c.weight * 100)}%)`,
    )
    .join('\n')

  // ── Build sections block ──────────────────────────────────────────────────
  const sectionsBlock = sections
    .map(
      (s) =>
        `=== ${s.section_name.toUpperCase()} ===\n${(s.content as string).slice(0, 8000)}`,
    )
    .join('\n\n')

  // ── System prompt — SSEB evaluator persona ────────────────────────────────
  const systemPrompt = `You are a senior federal contracting officer serving on a Source Selection Evaluation Board (SSEB). You evaluate proposals strictly according to the solicitation's evaluation criteria. You do NOT help write proposals — you evaluate them. Be direct, specific, and critical. Use standard government evaluation language: Outstanding, Good, Acceptable, Marginal, Unacceptable.

Your evaluation must be honest, rigorous, and actionable. Identify every weakness and risk that a real evaluator would note. Do not inflate scores to be kind.`

  // ── User prompt ───────────────────────────────────────────────────────────
  const criteriaSourceNote = hasSectionM
    ? `These criteria are extracted directly from Section M of the RFP.`
    : `Note: No Section M was detected in this RFP. Using standard federal evaluation criteria as a proxy.`

  const userPrompt = `Evaluate the following proposal against the RFP evaluation criteria.

${criteriaSourceNote}

EVALUATION CRITERIA (from Section M):
${criteriaBlock}

PROPOSAL SECTIONS:
${sectionsBlock}

For each criterion above, provide:
- score: integer 0–100
- verdict: exactly one of "Outstanding", "Good", "Acceptable", "Marginal", "Unacceptable"
- strengths: array of strings — what the proposal does well for this criterion (be specific, cite content)
- weaknesses: array of strings — specific gaps, missing elements, vague language
- risks: array of strings — what evaluators would flag as concerns or discriminators against award
- recommended_edits: array of strings — specific, actionable changes to improve the section

Then compute an overall weighted score (sum of score × weight for each criterion).
Provide a 2–4 sentence evaluator summary as a senior CO would write it.

Return ONLY valid JSON (no markdown, no explanation):
{
  "overall_score": integer 0–100,
  "overall_verdict": "outstanding" | "good" | "acceptable" | "marginal" | "unacceptable",
  "summary": "string",
  "criteria_scores": [
    {
      "criterion": "string",
      "weight": number (0–1),
      "weight_display": "string",
      "score": integer 0–100,
      "verdict": "Outstanding" | "Good" | "Acceptable" | "Marginal" | "Unacceptable",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "risks": ["string"],
      "recommended_edits": ["string"]
    }
  ]
}`

  // ── SSE streaming ─────────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        emit({ type: 'red_team_start', criteria_count: evalCriteria.length })

        let fullText = ''

        const stream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullText += chunk.delta.text
            emit({ type: 'red_team_chunk', text: chunk.delta.text })
          }
        }

        // ── Parse result ──────────────────────────────────────────────────
        const cleaned = fullText
          .replace(/^```(?:json)?\s*/m, '')
          .replace(/```\s*$/m, '')
          .trim()

        let result: RedTeamResult
        try {
          result = JSON.parse(cleaned) as RedTeamResult
        } catch {
          emit({ type: 'red_team_error', message: 'Failed to parse evaluator response. Please retry.' })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // Normalize verdict to lowercase for DB storage
        result.overall_verdict = overallVerdictKey(result.overall_score)

        // ── Save to DB ────────────────────────────────────────────────────
        const { data: saved, error: saveError } = await supabase
          .from('red_team_results')
          .insert({
            proposal_id: proposalId,
            user_id: user.id,
            overall_score: result.overall_score,
            overall_verdict: result.overall_verdict,
            criteria_scores: result.criteria_scores,
            summary: result.summary,
            evaluator_notes: hasSectionM
              ? 'Evaluated against Section M criteria extracted from the RFP.'
              : 'No Section M detected — evaluated against standard federal evaluation criteria.',
          })
          .select('id, created_at')
          .single()

        if (saveError) {
          emit({ type: 'red_team_error', message: `Failed to save results: ${saveError.message}` })
        } else {
          emit({ type: 'red_team_complete', result, id: saved.id, created_at: saved.created_at })
        }
      } catch (err) {
        emit({
          type: 'red_team_error',
          message: err instanceof Error ? err.message : 'Unknown error during evaluation',
        })
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
