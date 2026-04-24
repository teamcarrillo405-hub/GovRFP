import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import type { CriterionScore } from '@/lib/scoring/types'

interface Props {
  params: Promise<{ id: string }>
}

interface SectionScore {
  id: string
  section_name: string
  attempt: number
  score: number
  passed: boolean
  criteria_scores: CriterionScore[]
  critique: string
  gaps: string[]
  created_at: string
}

function scoreBar(score: number, className = '') {
  const color = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className={`w-full bg-gray-100 rounded-full h-2 ${className}`}>
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default async function ScoringPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, status')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  const { data: rows } = await supabase
    .from('section_scores')
    .select('id, section_name, attempt, score, passed, criteria_scores, critique, gaps, created_at')
    .eq('proposal_id', id)
    .order('section_name')
    .order('attempt')

  const scores = (rows ?? []) as SectionScore[]

  // Group by section_name
  const bySection: Record<string, SectionScore[]> = {}
  for (const row of scores) {
    if (!bySection[row.section_name]) bySection[row.section_name] = []
    bySection[row.section_name].push(row)
  }

  const sectionNames = Object.keys(bySection).sort()

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-700">{proposal.title}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Section Scores</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Section Scores</h1>
      <p className="text-sm text-gray-500 mb-8">
        Quality Watchdog scores per section — each attempt shows the per-criterion breakdown.
      </p>

      {sectionNames.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">No sections have been scored yet.</p>
          <p className="text-xs text-gray-500 mt-1">
            Scores appear after you generate sections in the proposal editor.
          </p>
          <Link
            href={`/proposals/${id}/editor`}
            className="mt-4 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Go to editor →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {sectionNames.map((sectionName) => {
            const attempts = bySection[sectionName]
            const latest = attempts[attempts.length - 1]
            return (
              <div key={sectionName} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">{sectionName}</h2>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      latest.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {latest.passed ? 'Approved' : 'Not approved'}
                    </span>
                    <span className={`text-xl font-bold ${
                      latest.score >= 90 ? 'text-green-600' : latest.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {latest.score}/100
                    </span>
                  </div>
                </div>

                {/* Per-attempt tabs (show all if more than 1 attempt) */}
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="px-6 py-5 border-b border-gray-50 last:border-0">
                    {attempts.length > 1 && (
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
                        Attempt {attempt.attempt} — Score: {attempt.score}/100
                        {attempt.passed ? ' ✓ Passed' : ''}
                      </p>
                    )}

                    {/* Criteria breakdown */}
                    {attempt.criteria_scores?.length > 0 && (
                      <div className="space-y-4 mb-4">
                        {attempt.criteria_scores.map((c) => (
                          <div key={c.ref}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700">{c.label}</span>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-gray-900">{c.score}/100</span>
                                <span className="text-xs text-gray-500">{Math.round(c.weight * 100)}%</span>
                              </div>
                            </div>
                            {scoreBar(c.score, 'mb-1')}
                            {c.rationale && (
                              <p className="text-xs text-gray-500">{c.rationale}</p>
                            )}
                            {c.gaps?.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {c.gaps.map((g, i) => (
                                  <li key={i} className="text-xs text-red-600 flex gap-1">
                                    <span>↳</span> {g}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Critique */}
                    {attempt.critique && (
                      <div className="mt-3 rounded-md bg-gray-50 border border-gray-100 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Critique</p>
                        <p className="text-sm text-gray-700">{attempt.critique}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
