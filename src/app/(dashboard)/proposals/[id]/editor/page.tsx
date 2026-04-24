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
    <main className="max-w-7xl mx-auto px-6 py-8">
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
        <span className="text-gray-900 font-medium">Editor</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{proposal.title}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/proposals/${id}/review`}
            className="text-sm font-medium text-purple-700 hover:text-purple-900"
          >
            Review & Comment
          </Link>
          <ExportButtons proposalId={id} />
        </div>
      </div>

      <ProposalEditor
        proposalId={id}
        initialSections={sections}
        requirements={requirements}
        complianceMatrix={complianceMatrix}
        rfpStructure={rfpStructure}
      />
    </main>
  )
}
