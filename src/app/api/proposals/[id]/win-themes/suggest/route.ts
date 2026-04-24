import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { title?: string; sectionContent?: string }
  const title = typeof body.title === 'string' ? body.title : 'federal construction proposal'
  const sectionContent = typeof body.sectionContent === 'string' ? body.sectionContent.slice(0, 3000) : ''

  const contextBlock = sectionContent
    ? `\n\nHere is some existing proposal content for context:\n${sectionContent}`
    : ''

  const prompt = `Suggest 3-5 win themes for a federal construction proposal titled "${title}". Win themes are short, compelling differentiator phrases that highlight the contractor's unique strengths (e.g. "15 years of federal construction experience", "HUBZone certified prime contractor", "ISO 9001 quality management system").${contextBlock}

Return ONLY a JSON array of strings. No explanation, no markdown, no extra text. Example: ["theme one", "theme two", "theme three"]`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()

    let themes: string[]
    try {
      const parsed: unknown = JSON.parse(cleaned)
      themes = Array.isArray(parsed)
        ? parsed.filter((t): t is string => typeof t === 'string').slice(0, 5)
        : []
    } catch {
      return NextResponse.json({ error: 'AI returned unparseable response' }, { status: 500 })
    }

    return NextResponse.json({ themes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 500 })
  }
}
