import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { detectWorkType } from '@/lib/questions/types'
import { getTemplatedQuestionsForWorkType } from '@/lib/questions/question-bank'
import { generateQuestions } from '@/lib/questions/generate'

/**
 * POST /api/proposals/[id]/questions
 *
 * Creates (or replaces) the in-progress question session for a proposal.
 * Combines templated questions (filtered by detected work type) with
 * Claude-generated, RFP-specific questions.
 *
 * Existing in-progress session for this proposal is marked 'abandoned'
 * before the new one is created — keeps history but only one active.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    return new Response('Payment required', { status: 402 })
  }

  // Load proposal + analysis + capability + PP titles
  const [proposalRes, analysisRes, capRes, ppRes] = await Promise.all([
    supabase.from('proposals').select('id, title, team_id').eq('id', proposalId).single(),
    supabase
      .from('rfp_analysis')
      .select('requirements, section_lm_crosswalk, win_factors, set_asides_detected')
      .eq('proposal_id', proposalId)
      .maybeSingle(),
    supabase
      .from('capability_statements')
      .select(
        'company_name, primary_naics, certifications, employee_count_range, bonding_capacity_single_usd',
      )
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('past_performance')
      .select('contract_title')
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  if (proposalRes.error || !proposalRes.data) {
    return new Response('Proposal not found', { status: 404 })
  }

  const proposal = proposalRes.data
  const analysis = analysisRes.data ?? { requirements: [], section_lm_crosswalk: [], win_factors: {}, set_asides_detected: [] }

  // Detect work type from win_factors.naics or capability primary_naics
  const winFactors = (analysis.win_factors ?? {}) as Record<string, unknown>
  const naics =
    typeof winFactors.naics === 'string'
      ? winFactors.naics
      : capRes.data?.primary_naics ?? null
  const workType = detectWorkType(naics)

  // Mark any existing in-progress sessions abandoned
  await supabase
    .from('question_sessions')
    .update({ status: 'abandoned' })
    .eq('proposal_id', proposalId)
    .eq('status', 'in_progress')

  // Create new session
  const { data: session, error: sessionErr } = await supabase
    .from('question_sessions')
    .insert({
      proposal_id: proposalId,
      user_id: user.id,
      team_id: proposal.team_id ?? null,
    })
    .select('id')
    .single()
  if (sessionErr || !session) {
    return new Response(`Failed to create session: ${sessionErr?.message}`, { status: 500 })
  }

  // Templated items
  const templated = getTemplatedQuestionsForWorkType(workType)

  // Generative items (Claude). Tolerate failure — templated still ships.
  let generative: Awaited<ReturnType<typeof generateQuestions>> = []
  try {
    generative = await generateQuestions({
      proposalTitle: proposal.title,
      rfpAnalysis: analysis,
      capabilitySummary: capRes.data ?? null,
      ppRecordTitles: (ppRes.data ?? []).map((r: { contract_title: string }) => r.contract_title),
    })
  } catch (e) {
    console.error('[questions] generative pass failed:', e)
  }

  // Build items array — templated first, then generative
  let position = 0
  const items: Array<Record<string, unknown>> = []

  for (const t of templated) {
    items.push({
      session_id: session.id,
      position: position++,
      source: 'template',
      template_key: t.key,
      category: t.category,
      question: t.question,
      context: t.context ?? null,
      required: t.required ?? false,
    })
  }

  for (const g of generative) {
    items.push({
      session_id: session.id,
      position: position++,
      source: 'generative',
      template_key: null,
      category: g.category,
      question: g.question,
      context: g.context || null,
      required: g.required,
    })
  }

  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from('question_session_items').insert(items)
    if (itemsErr) {
      return new Response(`Failed to insert items: ${itemsErr.message}`, { status: 500 })
    }
  }

  return NextResponse.json({
    sessionId: session.id,
    workType,
    templatedCount: templated.length,
    generativeCount: generative.length,
    totalCount: items.length,
  })
}

/**
 * PATCH /api/proposals/[id]/questions
 *
 * Body: { itemId, answer } — updates a single answer in the session.
 * RLS enforces access via the inherited session policy.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await _request.json().catch(() => null)
  const itemId = body?.itemId as string | undefined
  const answer = body?.answer as string | undefined
  if (!itemId) return new Response('itemId required', { status: 400 })

  const update: Record<string, unknown> = { answer: answer ?? null }
  if (answer && answer.trim().length > 0) {
    update.answered_at = new Date().toISOString()
  } else {
    update.answered_at = null
  }

  const { error } = await supabase.from('question_session_items').update(update).eq('id', itemId)
  if (error) return new Response(error.message, { status: 500 })

  return NextResponse.json({ ok: true })
}
