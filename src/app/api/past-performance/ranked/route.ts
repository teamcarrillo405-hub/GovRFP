import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankPastPerformance } from '@/lib/past-performance/ranker'

/**
 * GET /api/past-performance/ranked?proposalId=...
 *
 * Returns the user's PP records ranked by relevance to the given proposal's
 * RFP analysis. Used by the editor sidebar to surface top suggestions.
 *
 * Response: { ranked: Array<{ id, contract_title, customer_name, score, breakdown }> }
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const proposalId = searchParams.get('proposalId')
  if (!proposalId) return new Response('proposalId required', { status: 400 })

  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '5')))

  // Load analysis for ranking signals
  const analysisRes = await supabase
    .from('rfp_analysis')
    .select('win_factors, set_asides_detected')
    .eq('proposal_id', proposalId)
    .single()

  if (analysisRes.error || !analysisRes.data) {
    return Response.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const proposalRes = await supabase
    .from('proposals')
    .select('title, rfp_text')
    .eq('id', proposalId)
    .single()

  if (proposalRes.error || !proposalRes.data) {
    return Response.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const analysis = analysisRes.data
  const proposal = proposalRes.data

  // Load all PP records the user can see (RLS filters: solo + team)
  const { data: records, error: ppError } = await supabase
    .from('past_performance')
    .select('*')
    .order('updated_at', { ascending: false })

  if (ppError) {
    return NextResponse.json({ error: ppError.message }, { status: 500 })
  }

  const winFactors = (analysis.win_factors ?? {}) as Record<string, unknown>
  const rfpNaics =
    typeof winFactors.naics === 'string'
      ? winFactors.naics
      : null
  const rfpValueUsd =
    typeof winFactors.estimated_value_usd === 'number'
      ? winFactors.estimated_value_usd
      : null

  const rfpScopeText =
    [
      proposal.title ?? '',
      typeof winFactors.scope_summary === 'string' ? winFactors.scope_summary : '',
      // Cap rfp_text contribution — keyword extraction works fine on the first ~5K chars
      (proposal.rfp_text ?? '').slice(0, 5000),
    ]
      .filter(Boolean)
      .join(' ')

  const ranked = rankPastPerformance(
    records ?? [],
    {
      rfpNaics,
      rfpSetAsides: (analysis.set_asides_detected ?? []) as string[],
      rfpValueUsd,
      rfpScopeText,
    },
    limit,
  )

  return NextResponse.json({
    ranked: ranked.map((r) => ({
      id: r.record.id,
      contract_title: r.record.contract_title,
      customer_name: r.record.customer_name,
      naics_codes: r.record.naics_codes,
      set_asides_claimed: r.record.set_asides_claimed,
      contract_value_usd: r.record.contract_value_usd,
      cpars_rating: r.record.cpars_rating,
      score: r.score,
      breakdown: r.breakdown,
    })),
  })
}
