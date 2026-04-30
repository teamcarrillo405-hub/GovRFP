import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import ComplianceMatrix from '@/components/analysis/ComplianceMatrix'
import WinScoreCard from '@/components/analysis/WinScoreCard'
import SetAsideFlags from '@/components/analysis/SetAsideFlags'
import SectionLMCrosswalk from '@/components/analysis/SectionLMCrosswalk'
import SizeEligibilityCard from '@/components/sba/SizeEligibilityCard'
import type { RfpAnalysis } from '@/lib/analysis/types'
import type { CapabilityStatementRow } from '@/lib/capability-statement/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AnalysisPage({ params }: Props) {
  const { id } = await params // Next.js 16: params must be awaited
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Load proposal — RLS enforces user_id
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, status, team_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!proposal || proposal.status !== 'analyzed') {
    notFound()
  }

  // Load analysis data
  const { data: analysis, error } = await supabase
    .from('rfp_analysis')
    .select('*')
    .eq('proposal_id', id)
    .single()

  if (error || !analysis) {
    notFound()
  }

  const rfpAnalysis = analysis as unknown as RfpAnalysis

  // Load capability statement — team-scoped when available, else solo user row.
  // RLS on capability_statements handles access control; we just pick the right filter.
  const capQuery = supabase
    .from('capability_statements')
    .select('*')

  const teamId = (proposal as { team_id?: string | null }).team_id
  if (teamId) {
    capQuery.eq('team_id', teamId)
  } else {
    capQuery.eq('user_id', user.id).is('team_id', null)
  }

  const { data: capRow } = await capQuery.maybeSingle()
  const capabilityStatement = capRow as CapabilityStatementRow | null

  const GLASS = { background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12 } as const
  const LABEL = { fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 14 } as const

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(192,194,198,0.45)', marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: 'rgba(192,194,198,0.45)', textDecoration: 'none' }}>Dashboard</Link>
        <span>/</span>
        <Link href={`/proposals/${id}`} style={{ color: 'rgba(192,194,198,0.45)', textDecoration: 'none' }}>{proposal.title}</Link>
        <span>/</span>
        <span style={{ color: '#C0C2C6' }}>Analysis</span>
      </nav>

      <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0, marginBottom: 4 }}>RFP Analysis</h1>
      <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.45)', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 28 }}>
        Analyzed {new Date(rfpAnalysis.analyzed_at).toLocaleDateString()} · {rfpAnalysis.model_used}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...GLASS, padding: 20 }}>
            <div style={LABEL}>Win Probability</div>
            <WinScoreCard winScore={rfpAnalysis.win_score} winFactors={rfpAnalysis.win_factors} />
          </div>
          <div>
            <SizeEligibilityCard analysis={rfpAnalysis} capabilityStatement={capabilityStatement} />
          </div>
        </div>

        <div style={{ ...GLASS, padding: 20 }}>
          <div style={LABEL}>Set-Aside Preferences</div>
          <SetAsideFlags setAsidesDetected={rfpAnalysis.set_asides_detected} setAsideFlags={rfpAnalysis.set_aside_flags} />
        </div>

        <div style={{ ...GLASS, padding: 20, overflowX: 'auto' }}>
          <div style={LABEL}>Compliance Matrix</div>
          <ComplianceMatrix requirements={rfpAnalysis.requirements} complianceMatrix={rfpAnalysis.compliance_matrix} />
        </div>

        <div style={{ ...GLASS, padding: 20, overflowX: 'auto' }}>
          <div style={LABEL}>Section L/M Crosswalk</div>
          <SectionLMCrosswalk crosswalk={rfpAnalysis.section_lm_crosswalk} hasSectionL={rfpAnalysis.has_section_l} hasSectionM={rfpAnalysis.has_section_m} />
        </div>
      </div>
    </div>
  )
}
