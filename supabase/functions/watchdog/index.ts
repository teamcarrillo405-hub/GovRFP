import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Technical Watchdog — runs every 5 minutes via pg_cron.
 *
 * Detects and recovers three classes of stuck processes:
 *   1. Proposals stuck in 'analyzing' > 10 min
 *   2. Proposal sections stuck in 'generating' or 'scoring' > 10 min
 *   3. Question sessions stuck in 'generating' > 5 min
 *
 * For each stuck item: resets to a recoverable state and logs an
 * event to watchdog_events so the admin dashboard can surface them.
 */
Deno.serve(async (req) => {
  // Verify the request comes from pg_cron (service role key in Authorization header)
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.endsWith(serviceKey.slice(-20))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
    { auth: { persistSession: false } }
  )

  const now = new Date()
  const events: Array<{
    event_type: string
    entity_table: string
    entity_id: string
    stuck_status: string
    stuck_minutes: number
    action_taken: string
    resolved: boolean
    error_detail?: string
  }> = []
  let recovered = 0

  // ── 1. Proposals stuck in 'analyzing' ──────────────────────────────────
  const { data: stuckProposals } = await supabase
    .from('proposals')
    .select('id, status, updated_at')
    .eq('status', 'analyzing')
    .lt('updated_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString())

  for (const proposal of stuckProposals ?? []) {
    const stuckMin = Math.round(
      (now.getTime() - new Date(proposal.updated_at).getTime()) / 60000
    )
    await supabase
      .from('proposals')
      .update({ status: 'draft', updated_at: now.toISOString() })
      .eq('id', proposal.id)

    events.push({
      event_type: 'stuck_proposal',
      entity_table: 'proposals',
      entity_id: proposal.id,
      stuck_status: 'analyzing',
      stuck_minutes: stuckMin,
      action_taken: 'reset status to draft',
      resolved: true,
    })
    recovered++
  }

  // ── 2. Proposal sections stuck in 'generating' or 'scoring' ────────────
  const { data: stuckSections } = await supabase
    .from('proposal_sections')
    .select('id, proposal_id, section_name, draft_status, updated_at')
    .in('draft_status', ['generating', 'scoring'])
    .lt('updated_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString())

  for (const section of stuckSections ?? []) {
    const stuckMin = Math.round(
      (now.getTime() - new Date(section.updated_at).getTime()) / 60000
    )
    await supabase
      .from('proposal_sections')
      .update({
        draft_status: 'empty',
        scoring_status: 'failed',
        updated_at: now.toISOString(),
      })
      .eq('id', section.id)

    events.push({
      event_type: 'stuck_section',
      entity_table: 'proposal_sections',
      entity_id: section.id,
      stuck_status: section.draft_status,
      stuck_minutes: stuckMin,
      action_taken: 'reset draft_status to empty, scoring_status to failed',
      resolved: true,
    })
    recovered++
  }

  // ── 3. Question sessions stuck in 'generating' ─────────────────────────
  const { data: stuckSessions } = await supabase
    .from('question_sessions')
    .select('id, proposal_id, status, updated_at')
    .eq('status', 'generating')
    .lt('updated_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString())

  for (const session of stuckSessions ?? []) {
    const stuckMin = Math.round(
      (now.getTime() - new Date(session.updated_at).getTime()) / 60000
    )
    await supabase
      .from('question_sessions')
      .update({ status: 'error', updated_at: now.toISOString() })
      .eq('id', session.id)

    events.push({
      event_type: 'stuck_question_session',
      entity_table: 'question_sessions',
      entity_id: session.id,
      stuck_status: 'generating',
      stuck_minutes: stuckMin,
      action_taken: 'reset status to error',
      resolved: true,
    })
    recovered++
  }

  // ── Persist events ──────────────────────────────────────────────────────
  if (events.length > 0) {
    await supabase.from('watchdog_events').insert(events)
  }

  const summary = {
    run_at: now.toISOString(),
    recovered,
    stuck_proposals: (stuckProposals ?? []).length,
    stuck_sections: (stuckSections ?? []).length,
    stuck_sessions: (stuckSessions ?? []).length,
    events: events.map((e) => ({ type: e.event_type, id: e.entity_id, min: e.stuck_minutes })),
  }

  console.log('[watchdog]', JSON.stringify(summary))
  return Response.json(summary)
})
