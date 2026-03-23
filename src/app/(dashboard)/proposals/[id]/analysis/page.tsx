import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import ComplianceMatrix from '@/components/analysis/ComplianceMatrix'
import WinScoreCard from '@/components/analysis/WinScoreCard'
import SetAsideFlags from '@/components/analysis/SetAsideFlags'
import SectionLMCrosswalk from '@/components/analysis/SectionLMCrosswalk'
import type { RfpAnalysis } from '@/lib/analysis/types'

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
    .select('title, status')
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-gray-700">
          Dashboard
        </Link>
        <span>/</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-700">
          {proposal.title}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Analysis</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">RFP Analysis</h1>
      <p className="text-sm text-gray-500 mb-8">
        Analyzed {new Date(rfpAnalysis.analyzed_at).toLocaleDateString()} using{' '}
        {rfpAnalysis.model_used}
      </p>

      <div className="space-y-8">
        {/* Win Score */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Win Probability</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <WinScoreCard winScore={rfpAnalysis.win_score} winFactors={rfpAnalysis.win_factors} />
          </div>
        </section>

        {/* Set-Aside Flags */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Set-Aside Preferences</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <SetAsideFlags
              setAsidesDetected={rfpAnalysis.set_asides_detected}
              setAsideFlags={rfpAnalysis.set_aside_flags}
            />
          </div>
        </section>

        {/* Compliance Matrix */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Matrix</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6 overflow-x-auto">
            <ComplianceMatrix
              requirements={rfpAnalysis.requirements}
              complianceMatrix={rfpAnalysis.compliance_matrix}
            />
          </div>
        </section>

        {/* Section L/M Crosswalk */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Section L/M Crosswalk</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6 overflow-x-auto">
            <SectionLMCrosswalk
              crosswalk={rfpAnalysis.section_lm_crosswalk}
              hasSectionL={rfpAnalysis.has_section_l}
              hasSectionM={rfpAnalysis.has_section_m}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
