import Anthropic from '@anthropic-ai/sdk'
import type { SectionName } from '@/lib/editor/types'
import type { AnalysisRequirement } from '@/lib/analysis/types'
import type { ScoringMatrix, SectionScoreResult, CriterionScore } from './types'
import { PASS_THRESHOLD } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/**
 * Score a draft section against the RFP's evaluation criteria.
 *
 * Returns a structured SectionScoreResult with:
 * - total_score (0-100 weighted composite)
 * - passed (score >= PASS_THRESHOLD)
 * - per-criterion breakdown
 * - critique text to feed into the next redraft
 */
export async function scoreSection(
  content: string,
  sectionName: SectionName,
  attempt: number,
  matrix: ScoringMatrix,
  requirements: AnalysisRequirement[],
): Promise<SectionScoreResult> {
  const criteriaBlock = matrix.criteria
    .map(
      (c) =>
        `CRITERION "${c.ref}" — ${c.label} (weight: ${Math.round(c.weight * 100)}%)\n` +
        `  What to look for: ${c.description}`
    )
    .join('\n\n')

  const mandatoryReqs = requirements
    .filter((r) => r.classification === 'mandatory')
    .slice(0, 20)
    .map((r) => `[${r.id}] ${r.text}`)
    .join('\n')

  const systemPrompt = `You are a senior federal proposal evaluator with 15 years of source selection experience.
Your job is to score a proposed section against the RFP's evaluation criteria and return a structured JSON result.

EVALUATION CRITERIA (from RFP Section M or equivalent):
${criteriaBlock}

MANDATORY REQUIREMENTS to check (shall/must):
${mandatoryReqs || '(none specified — use criteria only)'}

SCORING INSTRUCTIONS:
- Score each criterion 0-100
- A criterion scores 100 only if FULLY addressed with specific evidence
- A criterion scores 0-50 if mentioned but vague or missing key details
- A criterion scores 51-89 if addressed but with notable gaps
- The total_score is the sum of (criterion_score × weight) across all criteria
- passed = total_score >= ${PASS_THRESHOLD}
- critique must be specific and actionable — name exact gaps and what content would fix them
- gaps is a list of short phrases (max 8) describing what is missing

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "criteria": [
    {
      "ref": "string",
      "label": "string",
      "score": 0-100,
      "weight": 0.0-1.0,
      "weighted": 0.0-100.0,
      "rationale": "string",
      "gaps": ["string"]
    }
  ],
  "total_score": 0-100,
  "passed": true|false,
  "critique": "string (specific, actionable, max 300 words)",
  "strengths": ["string"],
  "gaps": ["string"]
}`

  const userMsg = `Score this ${sectionName} section draft:

---BEGIN DRAFT---
${content.slice(0, 12000)}
---END DRAFT---`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return parseScoreResponse(raw, sectionName, attempt)
}

/**
 * Parse and validate Claude's score response.
 * Returns a safe fallback if parsing fails.
 */
export function parseScoreResponse(
  raw: string,
  sectionName: SectionName,
  attempt: number,
): SectionScoreResult {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    const parsed = JSON.parse(cleaned)

    const criteria: CriterionScore[] = (parsed.criteria ?? []).map((c: Record<string, unknown>) => ({
      ref: String(c.ref ?? ''),
      label: String(c.label ?? ''),
      score: clamp(Number(c.score ?? 0), 0, 100),
      weight: clamp(Number(c.weight ?? 0), 0, 1),
      weighted: clamp(Number(c.weighted ?? 0), 0, 100),
      rationale: String(c.rationale ?? ''),
      gaps: Array.isArray(c.gaps) ? c.gaps.map(String) : [],
    }))

    const totalScore = clamp(Number(parsed.total_score ?? 0), 0, 100)

    return {
      section: sectionName,
      attempt,
      total_score: totalScore,
      passed: totalScore >= PASS_THRESHOLD,
      criteria,
      critique: String(parsed.critique ?? ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    }
  } catch {
    // Fallback: assume it failed so the watchdog triggers a redraft
    return {
      section: sectionName,
      attempt,
      total_score: 0,
      passed: false,
      criteria: [],
      critique: 'Scoring failed — redrafting with full requirements coverage.',
      strengths: [],
      gaps: ['Unable to parse score response'],
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
