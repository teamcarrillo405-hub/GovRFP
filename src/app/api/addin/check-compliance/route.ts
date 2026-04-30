import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { extractBearer } from '@/lib/addin/auth-helper'

export async function POST(request: Request) {
  const token = extractBearer(request)
  if (!token) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json().catch(() => null)
  const text = (body?.text as string | undefined)?.trim()
  const criteria = (body?.criteria as string | undefined)?.trim()

  if (!text) return new Response('text required', { status: 400 })

  const criteriaBlock = criteria ? `Evaluation criteria:\n${criteria}\n\n` : ''

  const prompt = `You are a federal proposal evaluator. Score the following proposal text for compliance and quality.

${criteriaBlock}Proposal text:
${text}

Return ONLY valid JSON in this exact shape:
{
  "score": <integer 0-100>,
  "verdict": "<Go|Caution|No-Go>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<one sentence fix>"
}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  try {
    const parsed = JSON.parse(raw)
    return Response.json(parsed)
  } catch {
    return Response.json({ score: 0, verdict: 'No-Go', strengths: [], gaps: ['Could not parse evaluation'], recommendation: 'Try again with clearer text.' })
  }
}
