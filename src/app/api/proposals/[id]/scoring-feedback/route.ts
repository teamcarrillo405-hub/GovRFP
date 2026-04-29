import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { buildScoringMatrix } from '@/lib/scoring/types'
import type { AnalysisRequirement } from '@/lib/analysis/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const maxDuration = 60

interface ScoringFeedbackRequest {
  sectionName: string
  plainText: string
  requirements: AnalysisRequirement[]
}

export interface ScoringFeedbackResult {
  estimatedScore: number
  maxScore: number
  strengths: string[]
  weaknesses: string[]
  improvements: string[]
  matrixSource: 'section_lm' | 'default'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'viewer')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: ScoringFeedbackRequest
  try {
    body = await request.json() as ScoringFeedbackRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sectionName, plainText, requirements } = body

  if (!sectionName || !plainText || plainText.trim().length === 0) {
    return NextResponse.json({ error: 'sectionName and plainText are required' }, { status: 400 })
  }

  // Load section_lm_crosswalk so scoring uses the same matrix as the watchdog
  const { data: analysisData } = await supabase
    .from('rfp_analysis')
    .select('section_lm_crosswalk')
    .eq('proposal_id', proposalId)
    .single()

  const crosswalk = analysisData?.section_lm_crosswalk ?? []
  const matrix = buildScoringMatrix(proposalId, crosswalk, requirements)

  // Build structured criteria block for the prompt
  const criteriaBlock = matrix.criteria
    .map((c) =>
      `CRITERION "${c.ref}" — ${c.label} (weight: ${Math.round(c.weight * 100)}%)\n  ${c.description}`
    )
    .join('\n\n')

  const mandatoryReqs = requirements
    .filter((r) => r.classification === 'mandatory')
    .slice(0, 20)
    .map((r) => `[${r.id}] ${r.text}`)
    .join('\n')

  const matrixNote = matrix.source === 'section_lm'
    ? 'Using official Section M evaluation criteria from the RFP.'
    : 'No Section M found — using criteria derived from the RFP requirements.'

  const prompt = `You are a senior federal SSEB (Source Selection Evaluation Board) evaluator with 15 years of source selection experience.

${matrixNote}

EVALUATION CRITERIA:
${criteriaBlock}

MANDATORY REQUIREMENTS (shall/must):
${mandatoryReqs || '(none specified — use criteria only)'}

SECTION BEING EVALUATED: ${sectionName}

PROPOSAL CONTENT:
${plainText.slice(0, 8000)}

Score this section against the criteria above. Return ONLY valid JSON (no markdown):
{
  "estimatedScore": 0-100,
  "maxScore": 100,
  "strengths": ["specific strength tied to a criterion"],
  "weaknesses": ["specific gap tied to a criterion"],
  "improvements": ["concrete actionable improvement with what to add/change"]
}

Rules:
- strengths and weaknesses must reference specific criteria by name
- improvements must be specific enough to act on immediately
- estimatedScore reflects weighted performance across all criteria`

  let rawText = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type === 'text') rawText = block.text
  } catch (err) {
    console.error('Anthropic error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 502 })
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()

  let result: ScoringFeedbackResult
  try {
    const parsed = JSON.parse(cleaned)
    result = {
      estimatedScore: Math.min(100, Math.max(0, parsed.estimatedScore ?? 0)),
      maxScore: parsed.maxScore ?? 100,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      matrixSource: matrix.source,
    }
  } catch {
    console.error('JSON parse failed. Raw:', cleaned)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }

  return NextResponse.json(result)
}
