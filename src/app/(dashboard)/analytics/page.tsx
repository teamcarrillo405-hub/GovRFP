import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface ProposalRow {
  id: string
  title: string
  outcome: string | null
  submitted_at: string | null
  contract_value: number | null
  created_at: string
  win_score: number | null
  win_verdict: string | null
  naics_codes: string[] | null
  status: string
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const OUTCOME_BADGE: Record<string, { label: string; classes: string }> = {
  won:    { label: 'Won',     classes: 'bg-green-100 text-green-800 border border-green-200' },
  lost:   { label: 'Lost',    classes: 'bg-red-100 text-red-700 border border-red-200' },
  no_bid: { label: 'No Bid',  classes: 'bg-gray-100 text-gray-600 border border-gray-200' },
  pending:{ label: 'Pending', classes: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
}

export default async function AnalyticsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('proposals')
    .select(`
      id,
      title,
      outcome,
      submitted_at,
      contract_value,
      created_at,
      status,
      rfp_analysis (
        win_score,
        win_verdict,
        naics_codes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('analytics query error:', error)
  }

  // Flatten rfp_analysis join (Supabase returns it as array or object)
  const proposals: ProposalRow[] = (rows ?? []).map((r) => {
    const analysis = Array.isArray(r.rfp_analysis)
      ? r.rfp_analysis[0]
      : r.rfp_analysis
    return {
      id: r.id,
      title: r.title,
      outcome: r.outcome ?? null,
      submitted_at: r.submitted_at ?? null,
      contract_value: r.contract_value ?? null,
      created_at: r.created_at,
      status: r.status,
      win_score: analysis?.win_score ?? null,
      win_verdict: analysis?.win_verdict ?? null,
      naics_codes: analysis?.naics_codes ?? null,
    }
  })

  // ── Compute stats ──────────────────────────────────────────────────────────
  const total = proposals.length
  const won = proposals.filter((p) => p.outcome === 'won').length
  const lost = proposals.filter((p) => p.outcome === 'lost').length
  const noBid = proposals.filter((p) => p.outcome === 'no_bid').length
  const pending = proposals.filter(
    (p) => p.outcome === 'pending' || (p.outcome === null && p.status !== 'draft')
  ).length
  const withOutcome = won + lost
  const winRate = withOutcome > 0 ? Math.round((won / withOutcome) * 100) : 0

  const wonScores = proposals
    .filter((p) => p.outcome === 'won' && p.win_score !== null)
    .map((p) => p.win_score as number)
  const lostScores = proposals
    .filter((p) => p.outcome === 'lost' && p.win_score !== null)
    .map((p) => p.win_score as number)

  const avgWonScore =
    wonScores.length > 0
      ? Math.round(wonScores.reduce((a, b) => a + b, 0) / wonScores.length)
      : null
  const avgLostScore =
    lostScores.length > 0
      ? Math.round(lostScores.reduce((a, b) => a + b, 0) / lostScores.length)
      : null

  // Distribution percentages for stacked bar
  const distributionTotal = won + lost + noBid + pending || 1
  const wonPct = Math.round((won / distributionTotal) * 100)
  const lostPct = Math.round((lost / distributionTotal) * 100)
  const noBidPct = Math.round((noBid / distributionTotal) * 100)
  const pendingPct = 100 - wonPct - lostPct - noBidPct

  // Empty-state: fewer than 3 proposals with any outcome
  const outcomesSet = proposals.filter((p) => p.outcome !== null).length
  const showEmptyState = outcomesSet < 3

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-sans">

      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 uppercase tracking-tight">
          Win/Loss Analytics
        </h1>
        <p className="text-sm mt-1 font-semibold" style={{ color: '#ff7b20' }}>
          {withOutcome > 0
            ? `${winRate}% win rate across ${withOutcome} decided proposal${withOutcome !== 1 ? 's' : ''}`
            : 'Track your proposal outcomes to see your win rate'}
        </p>
      </div>

      {showEmptyState ? (
        /* ── Empty state ── */
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">No outcome data yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
            Mark at least 3 proposals as Won, Lost, No Bid, or Pending using the
            Outcome panel on each proposal page. This dashboard will then show your
            win rate, score comparisons, and outcome distribution.
          </p>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-1 px-4 py-2 bg-black text-[#FDFF66] text-sm font-bold rounded-lg hover:brightness-110 transition-all"
          >
            Go to Proposals →
          </Link>
          {outcomesSet > 0 && (
            <p className="text-xs text-gray-500 mt-4">
              {outcomesSet} of 3 outcomes recorded — keep going!
            </p>
          )}
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Proposals', value: total, color: 'text-gray-900' },
              { label: 'Win Rate', value: `${winRate}%`, color: 'text-green-700' },
              { label: 'Won', value: won, color: 'text-green-700' },
              { label: 'Lost', value: lost, color: 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-1"
              >
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {label}
                </span>
                <span className={`text-3xl font-black tabular-nums ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* ── Score vs Outcome bar chart ── */}
          {(avgWonScore !== null || avgLostScore !== null) && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">
                Avg Win Score by Outcome
              </h2>
              <div
                role="img"
                aria-label={`Average win score: Won ${avgWonScore ?? 'N/A'}, Lost ${avgLostScore ?? 'N/A'}`}
                className="space-y-4"
              >
                {avgWonScore !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-green-700">Won</span>
                      <span className="text-sm font-black text-green-700 tabular-nums">{avgWonScore}</span>
                    </div>
                    <div className="h-7 rounded-md bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-md bg-green-500 transition-all duration-500"
                        style={{ width: `${avgWonScore}%` }}
                      />
                    </div>
                  </div>
                )}
                {avgLostScore !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-red-600">Lost</span>
                      <span className="text-sm font-black text-red-600 tabular-nums">{avgLostScore}</span>
                    </div>
                    <div className="h-7 rounded-md bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-md bg-red-400 transition-all duration-500"
                        style={{ width: `${avgLostScore}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="sr-only">
                Bar chart comparing average win scores. Won proposals averaged {avgWonScore ?? 'N/A'} out of 100. Lost proposals averaged {avgLostScore ?? 'N/A'} out of 100.
              </p>
            </div>
          )}

          {/* ── Outcome distribution stacked bar ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              Outcome Distribution
            </h2>
            <div
              role="img"
              aria-label={`Outcome distribution: ${won} won, ${lost} lost, ${pending} pending`}
              className="h-8 rounded-lg overflow-hidden flex w-full mb-3"
            >
              {wonPct > 0 && (
                <div
                  className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                  style={{ width: `${wonPct}%` }}
                  title={`Won: ${wonPct}%`}
                >
                  {wonPct >= 10 ? `${wonPct}%` : ''}
                </div>
              )}
              {lostPct > 0 && (
                <div
                  className="bg-red-400 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                  style={{ width: `${lostPct}%` }}
                  title={`Lost: ${lostPct}%`}
                >
                  {lostPct >= 10 ? `${lostPct}%` : ''}
                </div>
              )}
              {noBidPct > 0 && (
                <div
                  className="bg-gray-300 h-full flex items-center justify-center text-gray-600 text-xs font-bold transition-all duration-500"
                  style={{ width: `${noBidPct}%` }}
                  title={`No Bid: ${noBidPct}%`}
                >
                  {noBidPct >= 10 ? `${noBidPct}%` : ''}
                </div>
              )}
              {pendingPct > 0 && (
                <div
                  className="bg-yellow-200 h-full flex items-center justify-center text-yellow-700 text-xs font-bold transition-all duration-500"
                  style={{ width: `${pendingPct}%` }}
                  title={`Pending: ${pendingPct}%`}
                >
                  {pendingPct >= 10 ? `${pendingPct}%` : ''}
                </div>
              )}
            </div>
            <p className="sr-only">
              Stacked bar showing proposal outcomes. {won} won ({winRate}%), {lost} lost, {pending} pending.
            </p>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
                Won ({won})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
                Lost ({lost})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />
                No Bid ({noBid})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />
                Pending ({pending})
              </span>
            </div>
          </div>

          {/* ── Proposals table ── */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                All Proposals
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Win Score
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Outcome
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Contract Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {proposals.map((p) => {
                    const badge = p.outcome ? OUTCOME_BADGE[p.outcome] : null
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/proposals/${p.id}`}
                            className="font-medium text-gray-900 hover:text-black hover:underline decoration-[#FDFF66] underline-offset-2 line-clamp-1"
                          >
                            {p.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          {p.win_score !== null ? (
                            <span className="font-black text-[#ff7b20] tabular-nums">
                              {p.win_score}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {badge ? (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">
                          {formatDate(p.submitted_at)}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-700 tabular-nums">
                          {formatCurrency(p.contract_value)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
