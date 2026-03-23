import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { buildSectionPrompt } from '@/lib/editor/draft-prompts'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    return new Response('Payment required', { status: 402 })
  }

  const body = await request.json()
  const section = body.section as string
  if (!SECTION_NAMES.includes(section as SectionName)) {
    return new Response('Invalid section name', { status: 400 })
  }
  const instruction = body.instruction as string | undefined

  // Load profile, past projects, key personnel, proposal (rfp_text), analysis (requirements)
  const [profileRes, pastProjectsRes, keyPersonnelRes, proposalRes, analysisRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('past_projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('key_personnel').select('*').eq('user_id', user.id),
    supabase.from('proposals').select('rfp_text').eq('id', proposalId).eq('user_id', user.id).single(),
    supabase.from('rfp_analysis').select('requirements').eq('proposal_id', proposalId).single(),
  ])

  const profile = profileRes.data
  const pastProjects = pastProjectsRes.data ?? []
  const keyPersonnel = keyPersonnelRes.data ?? []
  const rfpText = proposalRes.data?.rfp_text ?? ''
  const requirements = analysisRes.data?.requirements ?? []

  const systemPrompt = buildSectionPrompt(
    section as SectionName, profile, pastProjects, keyPersonnel, rfpText, requirements, instruction
  )

  // Update draft_status to 'generating'
  await supabase.from('proposal_sections').upsert({
    proposal_id: proposalId,
    user_id: user.id,
    section_name: section,
    draft_status: 'generating',
  }, { onConflict: 'proposal_id,section_name' })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Draft the ${section} section now.` }],
  })

  return new Response(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
