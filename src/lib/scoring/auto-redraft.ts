import Anthropic from '@anthropic-ai/sdk'
import type { SectionName } from '@/lib/editor/types'
import type { AnalysisRequirement } from '@/lib/analysis/types'
import { buildSectionPrompt } from '@/lib/editor/draft-prompts'
import { scoreSection } from './score-section'
import type { ScoringMatrix, WatchdogEvent } from './types'
import { MAX_ATTEMPTS, PASS_THRESHOLD } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface RedraftParams {
  section: SectionName
  proposalId: string
  profile: Parameters<typeof buildSectionPrompt>[1]
  pastProjects: Parameters<typeof buildSectionPrompt>[2]
  keyPersonnel: Parameters<typeof buildSectionPrompt>[3]
  rfpText: string
  requirements: AnalysisRequirement[]
  matrix: ScoringMatrix
  /** Optional user instruction (passed through on first attempt only) */
  instruction?: string
  /** User-provided real data collected via preflight modal */
  attachmentContext?: string
  /** Supabase client for persisting scores */
  supabase: ReturnType<typeof import('@/lib/supabase/server')['createClient']> extends Promise<infer T> ? T : never
}

/**
 * Quality Watchdog: draft → score → redraft loop.
 *
 * Yields WatchdogEvent objects as the loop progresses. The caller
 * serializes these to SSE and streams them to the client. The client
 * only renders content when it receives 'watchdog_approved' or
 * 'watchdog_failed' — it never sees intermediate rejected drafts.
 *
 * Attempt 1: draft with user instruction (if any)
 * Attempt 2+: draft with critique from previous score as instruction
 * Terminates when: score >= PASS_THRESHOLD OR attempt == MAX_ATTEMPTS
 */
export async function* autoRedraft(
  params: RedraftParams,
): AsyncGenerator<WatchdogEvent> {
  const {
    section, proposalId, profile, pastProjects, keyPersonnel,
    rfpText, requirements, matrix, supabase,
  } = params

  // Prepend attachment context to first instruction so preflight data lands in the prompt
  const baseInstruction = params.attachmentContext
    ? [params.attachmentContext, params.instruction].filter(Boolean).join('\n\n')
    : params.instruction

  let currentInstruction = baseInstruction
  let lastContent = ''
  let lastScore = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // --- Draft ---
    yield {
      type: 'watchdog_status',
      message: attempt === 1
        ? `Generating ${section} section...`
        : `Redrafting ${section} with quality critique (attempt ${attempt}/${MAX_ATTEMPTS})...`,
      attempt,
    }

    const systemPrompt = buildSectionPrompt(
      section, profile, pastProjects, keyPersonnel, rfpText, requirements, currentInstruction,
    )

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Draft the ${section} section now.` }],
    })

    // Accumulate full draft (no streaming to client during watchdog loop)
    let draftContent = ''
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        draftContent += chunk.delta.text
      }
    }

    draftContent = sanitizeHtml(draftContent)
    lastContent = draftContent

    // --- Score ---
    yield {
      type: 'watchdog_status',
      message: `Scoring ${section} against RFP evaluation criteria...`,
      attempt,
    }

    const sectionReqs = matrix.requirements_by_section[section] ?? requirements
    const scoreResult = await scoreSection(draftContent, section, attempt, matrix, sectionReqs)
    lastScore = scoreResult.total_score

    // Persist score to DB
    await supabase.from('section_scores').insert({
      proposal_id: proposalId,
      section_name: section,
      attempt,
      score: scoreResult.total_score,
      passed: scoreResult.passed,
      criteria_scores: scoreResult.criteria,
      critique: scoreResult.critique,
      gaps: scoreResult.gaps,
    })

    yield {
      type: 'watchdog_score',
      score: scoreResult.total_score,
      passed: scoreResult.passed,
      attempt,
      critique: scoreResult.passed
        ? scoreResult.strengths.slice(0, 2).join('. ')
        : scoreResult.critique,
    }

    if (scoreResult.passed || attempt === MAX_ATTEMPTS) {
      // Update proposal_sections with final score metadata
      await supabase.from('proposal_sections').upsert({
        proposal_id: proposalId,
        section_name: section,
        scoring_status: scoreResult.passed ? 'approved' : 'failed',
        score_value: scoreResult.total_score,
        score_pass: scoreResult.passed,
        draft_attempt: attempt,
        draft_status: 'draft',
      }, { onConflict: 'proposal_id,section_name' })

      if (scoreResult.passed) {
        yield {
          type: 'watchdog_approved',
          score: scoreResult.total_score,
          attempt,
          content: draftContent,
        }
      } else {
        // Max attempts exhausted — release best-effort draft anyway
        yield {
          type: 'watchdog_failed',
          attempts: attempt,
          last_score: scoreResult.total_score,
          content: draftContent,
        }
      }
      return
    }

    // Build improved instruction for next attempt using the critique
    currentInstruction = buildCritiqueInstruction(scoreResult.critique, scoreResult.gaps, scoreResult.total_score)
  }
}

function buildCritiqueInstruction(critique: string, gaps: string[], score: number): string {
  const gapList = gaps.slice(0, 6).map((g) => `- ${g}`).join('\n')
  return `QUALITY REVIEW — PREVIOUS SCORE: ${score}/${PASS_THRESHOLD} minimum required.

CRITIQUE FROM EVALUATOR:
${critique}

SPECIFIC GAPS TO FIX:
${gapList || '- Address all RFP requirements more specifically'}

Rewrite the section to address every gap above. Be more specific: cite exact requirements by ID,
include concrete examples, metrics, and evidence. Every mandatory (shall/must) requirement must
be explicitly addressed.`
}

function sanitizeHtml(raw: string): string {
  let html = raw.trim()
  const fenceMatch = html.match(/^```(?:html)?\s*([\s\S]*?)```\s*$/)
  if (fenceMatch) html = fenceMatch[1].trim()
  if (!html.startsWith('<')) {
    html = html.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
  }
  return html
}
