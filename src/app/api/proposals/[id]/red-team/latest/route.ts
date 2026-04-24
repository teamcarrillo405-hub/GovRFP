import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'viewer')
  if (!roleResult) return new Response('Forbidden', { status: 403 })

  // Load proposal title alongside the latest red team result
  const [proposalRes, resultRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('title')
      .eq('id', proposalId)
      .single(),
    supabase
      .from('red_team_results')
      .select('id, created_at, overall_score, overall_verdict, criteria_scores, summary, evaluator_notes')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const proposal_title = proposalRes.data?.title ?? null
  const row = resultRes.data

  if (!row) {
    return Response.json({ result: null, proposal_title })
  }

  return Response.json({
    result: {
      overall_score: row.overall_score,
      overall_verdict: row.overall_verdict,
      summary: row.summary,
      criteria_scores: row.criteria_scores,
    },
    id: row.id,
    created_at: row.created_at,
    proposal_title,
  })
}
