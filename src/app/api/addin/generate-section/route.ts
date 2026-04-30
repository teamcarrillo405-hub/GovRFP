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
  const sectionType = (body?.sectionType as string | undefined)?.trim()
  const rfpContext = (body?.rfpContext as string | undefined)?.trim()

  if (!sectionType) return new Response('sectionType required', { status: 400 })

  const prompt = rfpContext
    ? `You are a federal proposal writer. Draft the "${sectionType}" section of a government proposal.\n\nRFP context:\n${rfpContext}\n\nWrite a complete, professional section. Be specific. Use active voice. 250-400 words.`
    : `You are a federal proposal writer. Draft a professional "${sectionType}" section for a government proposal. Write 250-400 words. Use active voice and specific, measurable language.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return Response.json({ text })
}
