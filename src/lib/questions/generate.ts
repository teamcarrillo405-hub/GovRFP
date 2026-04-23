import Anthropic from '@anthropic-ai/sdk'
import type { QuestionCategory } from './types'
import { QUESTION_CATEGORIES } from './types'

/**
 * Generative question engine.
 *
 * Given the RFP analysis + capability statement + PP library summaries,
 * Claude produces 10-20 RFP-specific questions that the user MUST answer
 * before drafting begins. Combined with the templated bank for the
 * hybrid approach.
 *
 * Output is strict JSON: an array of { category, question, context, required }.
 * If parsing fails, we return an empty array — the templated questions still
 * carry the session.
 */

export interface GeneratedQuestion {
  category: QuestionCategory
  question: string
  context: string
  required: boolean
}

export interface GenerateInput {
  proposalTitle: string
  rfpAnalysis: {
    requirements?: unknown[]
    section_lm_crosswalk?: unknown[]
    win_factors?: Record<string, unknown>
    set_asides_detected?: string[]
  }
  capabilitySummary: {
    company_name?: string
    primary_naics?: string | null
    certifications?: string[]
    employee_count_range?: string | null
    bonding_capacity_single_usd?: number | null
  } | null
  /** Brief titles only — full PP library bloats the prompt unnecessarily */
  ppRecordTitles: string[]
}

const SYSTEM_PROMPT = `You are an expert federal proposal capture-manager. Given an analyzed RFP and the contractor's existing capability + past-performance summaries, generate 10-20 contract-specific questions the contractor MUST answer before drafting begins.

Rules:
- Skip anything already known (the contractor's company info, certifications, NAICS, etc. — that data is supplied below; don't ask it again).
- Ask only what unlocks better drafting: discriminator selection, named personnel for Section L roles, cost/schedule strategy, specific risk mitigations, RFP-specific compliance.
- Each question must be answerable in 1-3 sentences.
- Mark required=true only for questions whose absence would block evaluation (named PM, top discriminators, schedule feasibility).
- Categories MUST be from this exact list: ${QUESTION_CATEGORIES.join(', ')}
- Output STRICT JSON ONLY: an array of {category, question, context, required}. No markdown, no preamble, no commentary.
- 10-20 items total. Avoid duplicates with each other.`

export async function generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userPrompt = buildUserPrompt(input)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return parseQuestionList(text)
}

function buildUserPrompt(input: GenerateInput): string {
  const reqSummary = (input.rfpAnalysis.requirements ?? [])
    .slice(0, 25)
    .map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : JSON.stringify(r)}`)
    .join('\n')

  const lmSummary = (input.rfpAnalysis.section_lm_crosswalk ?? [])
    .slice(0, 15)
    .map((c) =>
      typeof c === 'object' && c
        ? `- ${JSON.stringify(c)}`
        : `- ${c}`,
    )
    .join('\n')

  return `PROPOSAL: ${input.proposalTitle}

CONTRACTOR CAPABILITY (already known — DO NOT ask about these):
${
  input.capabilitySummary
    ? Object.entries(input.capabilitySummary)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')
    : '(no capability statement entered — feel free to ask identity-confirming questions)'
}

PAST PERFORMANCE LIBRARY (titles only — DO NOT ask whether records exist):
${input.ppRecordTitles.length ? input.ppRecordTitles.map((t) => `- ${t}`).join('\n') : '(empty library)'}

RFP ANALYSIS:
- Set-asides detected: ${(input.rfpAnalysis.set_asides_detected ?? []).join(', ') || 'none'}
- Win factors: ${JSON.stringify(input.rfpAnalysis.win_factors ?? {})}

REQUIREMENTS (top 25):
${reqSummary || '(none extracted)'}

SECTION L/M CROSSWALK (top 15):
${lmSummary || '(none extracted)'}

Generate the question list now. Strict JSON array only.`
}

/**
 * Parse Claude output → GeneratedQuestion[]. Tolerant of common formatting
 * sins (markdown code fences, leading/trailing text).
 */
export function parseQuestionList(raw: string): GeneratedQuestion[] {
  let text = raw.trim()
  // Strip ```json ... ``` fences if present
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) text = fence[1].trim()
  // If model wrapped in prose, find the first [ and last ]
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []
  text = text.slice(start, end + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const valid: GeneratedQuestion[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const category = obj.category
    const question = obj.question
    if (typeof question !== 'string' || question.length === 0) continue
    if (typeof category !== 'string' || !QUESTION_CATEGORIES.includes(category as QuestionCategory)) {
      continue
    }
    valid.push({
      category: category as QuestionCategory,
      question: question.slice(0, 1000),
      context: typeof obj.context === 'string' ? obj.context.slice(0, 500) : '',
      required: obj.required === true,
    })
  }
  return valid
}
