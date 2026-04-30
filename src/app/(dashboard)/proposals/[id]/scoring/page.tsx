import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import { WatchdogEvolutionBar } from '@/components/scoring/WatchdogEvolutionBar'

interface Props {
  params: Promise<{ id: string }>
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#00C48C' : score >= 65 ? '#F59E0B' : '#FF1A1A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(192,194,198,0.12)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color, width: 28, textAlign: 'right' as const }}>{score}</span>
    </div>
  )
}

interface AttemptPoint {
  attempt: number
  avgScore: number
}

function ScoreHistoryChart({ points }: { points: AttemptPoint[] }) {
  if (points.length === 0) return null

  const WIDTH = 480
  const HEIGHT = 140
  const PAD_LEFT = 36
  const PAD_RIGHT = 20
  const PAD_TOP = 28
  const PAD_BOTTOM = 24

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const maxAttempt = Math.max(...points.map(p => p.attempt))
  const minAttempt = Math.min(...points.map(p => p.attempt))
  const attemptRange = maxAttempt === minAttempt ? 1 : maxAttempt - minAttempt

  function xOf(attempt: number): number {
    if (points.length === 1) return PAD_LEFT + chartW / 2
    return PAD_LEFT + ((attempt - minAttempt) / attemptRange) * chartW
  }

  function yOf(score: number): number {
    // score 0 -> bottom, 100 -> top
    return PAD_TOP + chartH - (score / 100) * chartH
  }

  // Build polyline points string
  const polylinePoints = points.map(p => `${xOf(p.attempt)},${yOf(p.avgScore)}`).join(' ')

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
    >
      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={PAD_LEFT} y1={yOf(tick)} x2={PAD_LEFT + chartW} y2={yOf(tick)} stroke="rgba(192,194,198,0.1)" strokeWidth={1} />
          <text x={PAD_LEFT - 6} y={yOf(tick) + 4} textAnchor="end" fontSize={9} fill="rgba(192,194,198,0.35)">{tick}</text>
        </g>
      ))}

      {points.length > 1 && (
        <polyline points={polylinePoints} fill="none" stroke="#FF1A1A" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {points.map((p, i) => {
        const cx = xOf(p.attempt)
        const cy = yOf(p.avgScore)
        const label = points.length === 1 ? 'First submission' : `Draft ${p.attempt}`
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill="#FF1A1A" stroke="rgba(11,11,13,0.8)" strokeWidth={2} />
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill="#F5F5F7">{Math.round(p.avgScore)}</text>
            <text x={cx} y={PAD_TOP + chartH + 14} textAnchor="middle" fontSize={9} fill="rgba(192,194,198,0.35)">{label}</text>
          </g>
        )
      })}
    </svg>
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
    .select('id, title, status')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  // Get section scores — de-duplicate to latest attempt per section
  const { data: sectionRows } = await supabase
    .from('section_scores')
    .select('id, section_name, attempt, score, passed, critique')
    .eq('proposal_id', id)
    .order('section_name')
    .order('attempt', { ascending: false })

  const seenSections = new Set<string>()
  const sections: { id: string; section_name: string; score: number; passed: boolean }[] = []
  for (const row of sectionRows ?? []) {
    if (!seenSections.has(row.section_name)) {
      seenSections.add(row.section_name)
      sections.push(row)
    }
  }

  // Group ALL section_scores rows by section_name for WatchdogEvolutionBar
  const watchdogBySection = new Map<string, Array<{ attempt: number; score: number; passed: boolean; critique: string | null }>>()
  for (const row of sectionRows ?? []) {
    const key = row.section_name as string
    const arr = watchdogBySection.get(key) ?? []
    arr.push({
      attempt: row.attempt as number,
      score: row.score as number,
      passed: row.passed as boolean,
      critique: row.critique as string | null,
    })
    watchdogBySection.set(key, arr)
  }

  // --- Score History: query ALL attempts ---
  const { data: allScoreRows } = await supabase
    .from('section_scores')
    .select('section_name, attempt, score, created_at')
    .eq('proposal_id', id)
    .order('attempt', { ascending: true })

  // Group by attempt number and compute average score per attempt
  const attemptMap = new Map<number, number[]>()
  for (const row of allScoreRows ?? []) {
    const a = row.attempt as number
    if (!attemptMap.has(a)) attemptMap.set(a, [])
    attemptMap.get(a)!.push(row.score as number)
  }

  const historyPoints: AttemptPoint[] = Array.from(attemptMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([attempt, scores]) => ({
      attempt,
      avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    }))

  const totalAttempts = historyPoints.length
  const hasHistory = totalAttempts >= 1

  // --- Delta computation for compare mode ---
  // latestAttemptScore - previousAttemptScore per section
  type DeltaMap = Record<string, number>
  let deltaMap: DeltaMap = {}
  const hasMultipleAttempts = totalAttempts >= 2

  if (hasMultipleAttempts && allScoreRows) {
    // Find max attempt number
    const maxAttempt = Math.max(...(allScoreRows.map(r => r.attempt as number)))
    const prevAttempt = maxAttempt - 1

    const latestScores: Record<string, number> = {}
    const prevScores: Record<string, number> = {}

    for (const row of allScoreRows) {
      if (row.attempt === maxAttempt) {
        latestScores[row.section_name as string] = row.score as number
      }
      if (row.attempt === prevAttempt) {
        prevScores[row.section_name as string] = row.score as number
      }
    }

    for (const sectionName of Object.keys(latestScores)) {
      if (prevScores[sectionName] !== undefined) {
        deltaMap[sectionName] = latestScores[sectionName] - prevScores[sectionName]
      }
    }
  }

  // Get red team result (table: red_team_results, field: summary)
  let redTeam: { overall_score: number | null; summary: string | null } | null = null
  try {
    const { data } = await supabase
      .from('red_team_results')
      .select('overall_score, summary')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    redTeam = data
  } catch {
    redTeam = null
  }

  const score = redTeam?.overall_score ?? 0
  const verdictLabel = score >= 80 ? 'Go' : score >= 65 ? 'Caution' : 'No-Go'
  const verdictColor = score >= 80 ? '#00C48C' : score >= 65 ? '#F59E0B' : '#FF4D4F'
  const reviewSteps = ['Draft 1', 'Draft 2', 'Pink Team', 'Red Team', 'Final']
  const currentStep = 3

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Link href={`/proposals/${id}/editor`} style={{ color: 'rgba(192,194,198,0.45)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
          <ChevronLeft size={14} strokeWidth={1.5} />{proposal.title}
        </Link>
      </div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.6)', flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Quality Watchdog Report
          </h1>
          <p style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', margin: '4px 0 0', letterSpacing: '0.06em' }}>
            Each section auto-drafted, scored vs Section M criteria, and redrafted until passing 75/100 threshold
          </p>
        </div>
      </div>

      {/* Score header */}
      <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Oxanium', sans-serif", color: verdictColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {score > 0 ? score : '—'} <span style={{ fontSize: 20, fontWeight: 500, color: 'rgba(192,194,198,0.35)' }}>/ 100</span>
          </div>
          {score > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', color: verdictColor, background: `${verdictColor}18`, padding: '5px 14px', borderRadius: 6 }}>
              {verdictLabel.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {reviewSteps.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < currentStep ? '#FF1A1A' : 'transparent', border: i < currentStep ? 'none' : i === currentStep ? '2px solid #FF1A1A' : '2px solid rgba(192,194,198,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: i < currentStep ? '#fff' : i === currentStep ? '#FF1A1A' : 'rgba(192,194,198,0.3)', fontSize: 10, fontWeight: 700 }}>
                  {i < currentStep ? <CheckCircle size={12} strokeWidth={2} /> : i + 1}
                </div>
                <span style={{ fontSize: 9, fontWeight: i === currentStep ? 700 : 500, fontFamily: "'Oxanium', sans-serif", color: i === currentStep ? '#F5F5F7' : 'rgba(192,194,198,0.35)', whiteSpace: 'nowrap' as const }}>{step}</span>
              </div>
              {i < reviewSteps.length - 1 && <div style={{ width: 40, height: 1, background: i < currentStep ? '#FF1A1A' : 'rgba(192,194,198,0.1)', margin: '0 4px', marginBottom: 18 }} />}
            </div>
          ))}
        </div>
      </div>

      {hasHistory && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 16 }}>Score History</div>
          <ScoreHistoryChart points={historyPoints} />
        </div>
      )}

      {watchdogBySection.size > 0 && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 16 }}>Section Breakdown</div>
          {Array.from(watchdogBySection.entries()).map(([section, attempts]) => (
            <WatchdogEvolutionBar key={section} section={section} attempts={attempts} threshold={75} />
          ))}
        </div>
      )}

      {redTeam?.summary && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 12 }}>Red Team Summary</div>
          <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.7)', lineHeight: 1.6, margin: 0 }}>{redTeam.summary}</p>
        </div>
      )}

      {score === 0 && sections.length === 0 && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: '40px', textAlign: 'center' as const }}>
          <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.45)', marginBottom: 12 }}>No scoring data yet. Run Red Team analysis to score this proposal.</p>
          <Link href={`/proposals/${id}/red-team`} style={{ display: 'inline-block', background: '#FF1A1A', color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textDecoration: 'none' }}>
            START RED TEAM REVIEW
          </Link>
        </div>
      )}
    </div>
  )
}
