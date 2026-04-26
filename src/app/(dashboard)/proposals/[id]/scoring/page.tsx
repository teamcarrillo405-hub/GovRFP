import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { ChevronLeft, CheckCircle } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
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

      {/* Section breakdown */}
      {sections.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Section Breakdown</div>
          {sections.map(s => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{s.section_name}</span>
              <ScoreBar score={s.score ?? 0} />
            </div>
          ))}
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
