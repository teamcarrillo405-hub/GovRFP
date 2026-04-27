import { createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'
import { buildScoringMatrix } from '@/lib/scoring/types'
import { autoRedraft } from '@/lib/scoring/auto-redraft'
import type { WatchdogEvent } from '@/lib/scoring/types'

export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return new Response('Forbidden', { status: 403 })

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

  // Load all context in parallel
  const [profileRes, pastProjectsRes, keyPersonnelRes, proposalRes, analysisRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('past_projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('key_personnel').select('*').eq('user_id', user.id),
    supabase.from('proposals').select('rfp_text').eq('id', proposalId).single(),
    supabase.from('rfp_analysis').select('requirements, section_lm_crosswalk').eq('proposal_id', proposalId).single(),
  ])

  const profile = profileRes.data
  const pastProjects = pastProjectsRes.data ?? []
  const keyPersonnel = keyPersonnelRes.data ?? []
  const proposal = proposalRes.data
  if (!proposal) return new Response('Not found', { status: 404 })
  const rfpText = proposal.rfp_text ?? ''
  const requirements = analysisRes.data?.requirements ?? []
  const crosswalk = analysisRes.data?.section_lm_crosswalk ?? []

  // Build scoring matrix from L/M crosswalk (or default criteria if not available)
  const matrix = buildScoringMatrix(proposalId, crosswalk, requirements)

  // Mark section as 'generating' while the watchdog loop runs
  await supabase.from('proposal_sections').upsert({
    proposal_id: proposalId,
    user_id: user.id,
    section_name: section,
    draft_status: 'generating',
    scoring_status: 'pending',
  }, { onConflict: 'proposal_id,section_name' })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (event: WatchdogEvent | { type: string; [k: string]: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Emit matrix source so client knows what scoring basis was used
        emit({ type: 'watchdog_matrix', source: matrix.source, criteria_count: matrix.criteria.length })

        for await (const event of autoRedraft({
          section: section as SectionName,
          proposalId,
          profile,
          pastProjects,
          keyPersonnel,
          rfpText,
          requirements,
          matrix,
          instruction,
          supabase,
        })) {
          emit(event)

          // When scoring starts, update DB status
          if (event.type === 'watchdog_status' && event.message.startsWith('Scoring')) {
            await supabase.from('proposal_sections').upsert({
              proposal_id: proposalId,
              user_id: user.id,
              section_name: section,
              draft_status: 'scoring',
              scoring_status: 'scoring',
            }, { onConflict: 'proposal_id,section_name' })
          }

          // On approval or failure, save the final content
          if (event.type === 'watchdog_approved' || event.type === 'watchdog_failed') {
            const approved = event.type === 'watchdog_approved'
            await supabase.from('proposal_sections').upsert({
              proposal_id: proposalId,
              user_id: user.id,
              section_name: section,
              content: event.content,
              draft_status: 'draft',
              scoring_status: approved ? 'approved' : 'failed',
              score_value: approved ? event.score : (event as { last_score: number }).last_score,
              score_pass: approved,
              last_saved_at: new Date().toISOString(),
            }, { onConflict: 'proposal_id,section_name' })
          }
        }
      } catch (err) {
        emit({ type: 'watchdog_error', message: err instanceof Error ? err.message : 'Unknown error' })
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
