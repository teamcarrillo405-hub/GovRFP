import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { buildTailorPrompt } from '@/lib/past-performance/tailor'

/**
 * POST /api/past-performance/tailor
 *
 * Streams a Claude-drafted Past Performance narrative tailored to the
 * current proposal's RFP analysis. Body: { proposalId, ppId }.
 *
 * Prompt caching: the RFP analysis context block is cache_control:ephemeral,
 * so drafting multiple PPs for the same proposal in <5 min reuses the cached
 * tokens (60-80% cost reduction per subsequent call).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    return new Response('Payment required', { status: 402 })
  }

  const body = await request.json().catch(() => null)
  const proposalId = body?.proposalId as string | undefined
  const ppId = body?.ppId as string | undefined
  if (!proposalId || !ppId) return new Response('proposalId and ppId required', { status: 400 })

  const [ppRes, proposalRes, analysisRes] = await Promise.all([
    supabase.from('past_performance').select('*').eq('id', ppId).single(),
    supabase.from('proposals').select('id, title').eq('id', proposalId).single(),
    supabase
      .from('rfp_analysis')
      .select('requirements, section_lm_crosswalk, win_factors')
      .eq('proposal_id', proposalId)
      .single(),
  ])

  if (ppRes.error || !ppRes.data) return new Response('Past performance record not found', { status: 404 })
  if (proposalRes.error || !proposalRes.data) return new Response('Proposal not found', { status: 404 })

  const { system, userMessage } = buildTailorPrompt(
    ppRes.data,
    analysisRes.data ?? { requirements: [] },
    proposalRes.data.title,
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })

  // Forward as a plain text stream — the client appends to the editor
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
