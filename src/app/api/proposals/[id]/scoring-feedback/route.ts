import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
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
    return NextResponse.json(
      { error: 'sectionName and plainText are required' },
      { status: 400 },
    )
  }

  const prompt = `You are a federal SSEB (Source Selection Evaluation Board) evaluator.
Evaluate this proposal section against the requirements below.

Section: ${sectionName}
Content: ${plainText.slice(0, 6000)}
Requirements: ${JSON.stringify(requirements.slice(0, 30))}

Return ONLY valid JSON (no markdown):
{"estimatedScore": 0-100, "maxScore": 100, "strengths": [], "weaknesses": [], "improvements": []}`

  let rawText = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type === 'text') {
      rawText = block.text
    }
  } catch (err) {
    console.error('Anthropic error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 502 })
  }

  // Strip any accidental markdown fences
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()

  let result: ScoringFeedbackResult
  try {
    result = JSON.parse(cleaned) as ScoringFeedbackResult
  } catch {
    console.error('JSON parse failed. Raw:', cleaned)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
  }

  // Clamp score values to valid range
  result.estimatedScore = Math.min(100, Math.max(0, result.estimatedScore ?? 0))
  result.maxScore = result.maxScore ?? 100

  return NextResponse.json(result)
}
