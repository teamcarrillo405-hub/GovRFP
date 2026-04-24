import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import ProposalEditor from '@/components/editor/ProposalEditor'
import ExportButtons from '@/components/export/ExportButtons'
import type { ProposalSection } from '@/lib/editor/types'
import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'
import type { RfpStructure } from '@/lib/documents/rfp-structure'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params // Next.js 16: params must be awaited
  const user = await getUser()
  if (!user) redirect('/login')

  // Subscription gate — editor requires active subscription
  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    redirect('/account')
  }

  const supabase = await createClient()

  // Load proposal — RLS enforces user_id
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, rfp_text, status, rfp_structure')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Must exist and be analyzed before editor is accessible
  if (!proposal || proposal.status !== 'analyzed') {
    redirect(`/proposals/${id}`)
  }

  const rfpStructure = (proposal.rfp_structure ?? null) as RfpStructure | null

  // Load sections, analysis in parallel
  const [sectionsResult, analysisResult] = await Promise.all([
    supabase
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', id),
    supabase
      .from('rfp_analysis')
      .select('requirements, compliance_matrix')
      .eq('proposal_id', id)
      .single(),
  ])

  const sections = (sectionsResult.data ?? []) as ProposalSection[]
  const requirements = ((analysisResult.data?.requirements ?? []) as AnalysisRequirement[])
  const complianceMatrix = ((analysisResult.data?.compliance_matrix ?? []) as ComplianceMatrixRow[])

  return (
    // Full-bleed: fills the remaining viewport below the 56px fixed header (pt-14 in layout)
    <main className="flex flex-col h-[calc(100vh-56px)]">
      {/* Compact header bar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-gray-200 shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
            <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
              Dashboard
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/proposals/${id}`} className="hover:text-gray-700 transition-colors truncate max-w-[200px]">
              {proposal.title}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-900 font-medium">Editor</span>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/proposals/${id}/review`}
            className="text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
          >
            Review &amp; Comment
          </Link>
          <ExportButtons proposalId={id} />
        </div>
      </div>

      {/* Editor fills remaining height */}
      <ProposalEditor
        proposalId={id}
        initialSections={sections}
        requirements={requirements}
        complianceMatrix={complianceMatrix}
        rfpStructure={rfpStructure}
        className="flex-1 overflow-hidden"
      />
    </main>
  )
}
