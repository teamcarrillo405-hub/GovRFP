import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { ChevronLeft, CheckCircle } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ compare?: string }>
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: '#2F80FF', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', width: 28, textAlign: 'right' as const }}>{score}</span>
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

  // Y-axis gridlines at 0, 25, 50, 75, 100
  const yTicks = [0, 25, 50, 75, 100]

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
    >
      {/* Y gridlines */}
      {yTicks.map(tick => (
        <g key={tick}>
          <line
            x1={PAD_LEFT}
            y1={yOf(tick)}
            x2={PAD_LEFT + chartW}
            y2={yOf(tick)}
            stroke="#E2E8F0"
            strokeWidth={1}
          />
          <text
            x={PAD_LEFT - 6}
            y={yOf(tick) + 4}
            textAnchor="end"
            fontSize={9}
            fill="#94A3B8"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* Line */}
      {points.length > 1 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#2F80FF"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots and labels */}
      {points.map((p, i) => {
        const cx = xOf(p.attempt)
        const cy = yOf(p.avgScore)
        const label = points.length === 1 ? 'First submission' : `Draft ${p.attempt}`
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill="#2F80FF" stroke="#fff" strokeWidth={2} />
            {/* Score label above dot */}
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="#0F172A"
            >
              {Math.round(p.avgScore)}
            </text>
            {/* X axis label below chart */}
            <text
              x={cx}
              y={PAD_TOP + chartH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#94A3B8"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default async function ScoringPage({ params, searchParams }: Props) {
  const { id } = await params
  const { compare } = await searchParams
  const compareMode = compare === '1'

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

  const compareHref = compareMode
    ? `/proposals/${id}/scoring`
    : `/proposals/${id}/scoring?compare=1`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Link href={`/proposals/${id}/editor`} style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
          <ChevronLeft size={14} strokeWidth={1.5} />{proposal.title}
        </Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: 20 }}>Scoring & Red Team</h1>

      {/* Score header */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {score > 0 ? score : '—'} <span style={{ fontSize: 20, fontWeight: 500, color: '#94A3B8' }}>/ 100</span>
          </div>
          {score > 0 && (
            <span style={{ fontSize: 14, fontWeight: 700, color: verdictColor, background: `${verdictColor}14`, padding: '6px 14px', borderRadius: 6 }}>
              {verdictLabel}
            </span>
          )}
        </div>

        {/* Step tracker */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {reviewSteps.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < currentStep ? '#2F80FF' : 'transparent', border: i < currentStep ? 'none' : i === currentStep ? '2px solid #2F80FF' : '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: i < currentStep ? '#fff' : i === currentStep ? '#2F80FF' : '#94A3B8', fontSize: 10, fontWeight: 700 }}>
                  {i < currentStep ? <CheckCircle size={12} strokeWidth={2} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: i === currentStep ? 700 : 500, color: i === currentStep ? '#0F172A' : '#94A3B8', whiteSpace: 'nowrap' as const }}>{step}</span>
              </div>
              {i < reviewSteps.length - 1 && <div style={{ width: 40, height: 1, background: i < currentStep ? '#2F80FF' : '#E2E8F0', margin: '0 4px', marginBottom: 18 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Score History Chart — between step tracker and section breakdown */}
      {hasHistory && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Score History</div>
          <ScoreHistoryChart points={historyPoints} />
        </div>
      )}

      {/* Section breakdown */}
      {sections.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Section Breakdown</div>
            {hasMultipleAttempts && (
              <Link
                href={compareHref}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: compareMode ? '#fff' : '#2F80FF',
                  background: compareMode ? '#2F80FF' : '#2F80FF14',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {compareMode ? 'Hide comparison' : 'Compare Drafts'}
              </Link>
            )}
          </div>
          {sections.map(s => {
            const delta = compareMode ? deltaMap[s.section_name] : undefined
            const deltaColor =
              delta === undefined
                ? '#94A3B8'
                : delta > 0
                ? '#00C48C'
                : delta < 0
                ? '#FF4D4F'
                : '#94A3B8'
            const deltaLabel =
              delta === undefined
                ? null
                : delta > 0
                ? `+${delta}`
                : delta < 0
                ? `\u2212${Math.abs(delta)}`
                : '0'
            const deltaArrow =
              delta === undefined ? null : delta > 0 ? '\u25b2' : delta < 0 ? '\u25bc' : '\u2014'

            return (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: compareMode ? '180px 1fr 56px' : '180px 1fr',
                  gap: 12,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{s.section_name}</span>
                <ScoreBar score={s.score ?? 0} />
                {compareMode && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: deltaColor,
                      textAlign: 'right' as const,
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {deltaArrow !== null && deltaLabel !== null
                      ? `${deltaArrow} ${deltaLabel}`
                      : '\u2014'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Red team summary */}
      {redTeam?.summary && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Red Team Summary</div>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{redTeam.summary}</p>
        </div>
      )}

      {score === 0 && sections.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '32px', textAlign: 'center' as const }}>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>No scoring data yet. Run Red Team analysis to score this proposal.</p>
          <Link href={`/proposals/${id}/red-team`} style={{ display: 'inline-block', marginTop: 12, background: '#2F80FF', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Start Red Team Review
          </Link>
        </div>
      )}
    </div>
  )
}
