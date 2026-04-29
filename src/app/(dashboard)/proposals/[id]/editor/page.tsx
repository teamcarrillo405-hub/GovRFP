import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import ProposalEditor from '@/components/editor/ProposalEditor'
import ExportButtons from '@/components/export/ExportButtons'
import type { ProposalSection } from '@/lib/editor/types'
import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'
import type { RfpStructure } from '@/lib/documents/rfp-structure'
import Link from 'next/link'
import { ChevronLeft, Clock, Download, ClipboardList, History, ShieldCheck, DollarSign, Users, ExternalLink } from 'lucide-react'

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
    .select('id, title, rfp_text, status, rfp_structure, updated_at, opportunity_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Allow: analyzed proposals OR draft proposals created from a SAM.gov opportunity
  const editorAllowed =
    proposal?.status === 'analyzed' ||
    (proposal?.status === 'draft' && (proposal as any).opportunity_id)

  if (!proposal || !editorAllowed) {
    redirect(`/proposals/${id}`)
  }

  const rfpStructure = (proposal.rfp_structure ?? null) as RfpStructure | null

  // Load RFP URL when proposal came from a SAM.gov opportunity
  let rfpUrl: string | null = null
  if ((proposal as any).opportunity_id) {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('sam_url')
      .eq('id', (proposal as any).opportunity_id)
      .single()
    rfpUrl = opp?.sam_url ?? null
  }

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

  const updatedAt = proposal.updated_at
    ? new Date(proposal.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px - 44px)', marginTop: -28, marginLeft: -28, marginRight: -28 }}>
      {/* Top bar */}
      <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <Link href="/proposals" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
          <ChevronLeft size={14} strokeWidth={1.5} />
          Proposals
        </Link>
        <span style={{ color: '#E2E8F0' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{proposal.title}</span>
        <Link
          href={`/proposals/${id}/tasks`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#2F80FF',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
          }}
        >
          <ClipboardList size={13} strokeWidth={1.5} />
          Tasks
        </Link>
        <Link
          href={`/proposals/${id}/history`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#2F80FF',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
          }}
        >
          <History size={13} strokeWidth={1.5} />
          History
        </Link>
        <Link
          href={`/proposals/${id}/construction-compliance`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#2F80FF',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
          }}
        >
          <ShieldCheck size={13} strokeWidth={1.5} />
          Construction Compliance
        </Link>
        <Link
          href={`/proposals/${id}/prevailing-wage`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#2F80FF',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
          }}
        >
          <DollarSign size={13} strokeWidth={1.5} />
          Prevailing Wage
        </Link>
        <Link
          href={`/proposals/${id}/teaming`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#2F80FF',
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
          }}
        >
          <Users size={13} strokeWidth={1.5} />
          Teaming
        </Link>
        {rfpUrl && (
          <a
            href={rfpUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: '#0F172A',
              textDecoration: 'none',
              padding: '4px 10px',
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              background: '#F8FAFC',
            }}
          >
            <ExternalLink size={13} strokeWidth={1.5} />
            View RFP
          </a>
        )}
        <div style={{ flex: 1 }} />
        {updatedAt && (
          <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} strokeWidth={1.5} />
            Saved {updatedAt}
          </span>
        )}
        <ExportButtons proposalId={id} />
      </div>

      {/* Editor body — full width, full height */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          <ProposalEditor
            proposalId={id}
            initialSections={sections}
            requirements={requirements}
            complianceMatrix={complianceMatrix}
            rfpStructure={rfpStructure}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
