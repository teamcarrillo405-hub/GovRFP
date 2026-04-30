import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'
import type { JSONContent } from '@tiptap/react'
import { ReadOnlySectionContent } from '@/components/editor/ReadOnlySectionContent'
import { CommentThread } from '@/components/editor/CommentThread'
import type { SectionComment } from './actions'
import { generateComplianceAlerts } from '@/lib/editor/compliance-alerts'
import { ComplianceAlertsPanel } from '@/components/editor/ComplianceAlertsPanel'
import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  empty: 'Not drafted',
  generating: 'Generating…',
  scoring: 'Scoring…',
  draft: 'Draft',
  edited: 'Edited',
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  empty:  { color: '#94A3B8', bg: '#94A3B814' },
  draft:  { color: '#2F80FF', bg: '#2F80FF14' },
  edited: { color: '#00C48C', bg: '#00C48C14' },
}

export default async function ReviewPage({ params }: Props) {
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

  const [sectionsResult, commentsResult, analysisResult] = await Promise.all([
    supabase
      .from('proposal_sections')
      .select('section_name, content, draft_status')
      .eq('proposal_id', id),
    supabase
      .from('section_comments')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('rfp_analysis')
      .select('requirements, compliance_matrix')
      .eq('proposal_id', id)
      .maybeSingle(),
  ])

  const sections = sectionsResult.data ?? []
  const allComments = (commentsResult.data ?? []) as SectionComment[]

  // Build section word counts from Tiptap JSON content (rough estimate)
  const sectionWordCounts: Record<string, number> = {}
  for (const section of sections) {
    if (section.content) {
      const words = JSON.stringify(section.content).split(/\s+/).length
      sectionWordCounts[section.section_name] = words
    }
  }

  // Generate compliance alerts from analysis data
  const requirements = (analysisResult.data?.requirements ?? []) as AnalysisRequirement[]
  const matrix = (analysisResult.data?.compliance_matrix ?? []) as ComplianceMatrixRow[]
  const complianceAlerts = generateComplianceAlerts(requirements, matrix, sectionWordCounts)

  const commentsBySection = allComments.reduce<Record<string, SectionComment[]>>((acc, c) => {
    if (!acc[c.section_name]) acc[c.section_name] = []
    acc[c.section_name].push(c)
    return acc
  }, {})

  const sectionMap = new Map(
    sections.map((s) => [s.section_name as SectionName, s]),
  )

  const totalUnresolved = allComments.filter((c) => !c.resolved).length

  return (
    <div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(192,194,198,0.45)', marginBottom: 20 }}>
        <Link href="/dashboard" style={{ color: 'rgba(192,194,198,0.45)', textDecoration: 'none' }}>Dashboard</Link>
        <span>/</span>
        <Link href={`/proposals/${id}`} style={{ color: 'rgba(192,194,198,0.45)', textDecoration: 'none' }}>{proposal.title}</Link>
        <span>/</span>
        <span style={{ color: '#C0C2C6' }}>Review</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', margin: 0 }}>{proposal.title}</h1>
          {totalUnresolved > 0 && (
            <p style={{ fontSize: 12, color: '#F59E0B', marginTop: 4 }}>{totalUnresolved} unresolved comment{totalUnresolved !== 1 ? 's' : ''}</p>
          )}
        </div>
        {proposal.status === 'analyzed' && (
          <Link href={`/proposals/${id}/editor`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#FF1A1A', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em', borderRadius: 8, textDecoration: 'none', flexShrink: 0 }}>
            OPEN EDITOR →
          </Link>
        )}
      </div>

      {/* Pre-Submission Alerts */}
      <div style={{
        marginBottom: 32,
        padding: '20px 24px',
        borderRadius: 12,
        background: 'rgba(11,11,13,0.6)',
        border: '1px solid rgba(192,194,198,0.08)',
      }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(192,194,198,0.45)',
          marginBottom: 16,
        }}>
          Pre-Submission Alerts
        </div>
        <ComplianceAlertsPanel alerts={complianceAlerts} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {SECTION_NAMES.map((sectionName) => {
          const section = sectionMap.get(sectionName)
          const sectionComments = commentsBySection[sectionName] ?? []
          const unresolvedCount = sectionComments.filter((c) => !c.resolved).length
          const hasContent = section?.draft_status && section.draft_status !== 'empty'

          return (
            <section key={sectionName}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(192,194,198,0.08)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0 }}>{sectionName}</h2>
                {(() => {
                  const sc = STATUS_COLOR[section?.draft_status ?? 'empty'] ?? STATUS_COLOR.empty
                  return (
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 9999, color: sc.color, background: sc.bg }}>
                      {(STATUS_LABEL[section?.draft_status ?? 'empty'] ?? section?.draft_status ?? '').toUpperCase()}
                    </span>
                  )
                })()}
                {unresolvedCount > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 9999, color: '#F59E0B', background: '#F59E0B14' }}>
                    {unresolvedCount} COMMENT{unresolvedCount !== 1 ? 'S' : ''}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  {hasContent && section?.content ? (
                    <ReadOnlySectionContent content={section.content as JSONContent} />
                  ) : (
                    <div style={{ borderRadius: 10, border: '2px dashed rgba(192,194,198,0.15)', padding: 32, textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.45)', marginBottom: 8 }}>No draft yet for this section.</p>
                      {proposal.status === 'analyzed' && (
                        <Link href={`/proposals/${id}/editor`} style={{ fontSize: 12, color: '#FF1A1A', textDecoration: 'none' }}>Generate in editor →</Link>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(192,194,198,0.55)', marginBottom: 12 }}>
                    Comments{sectionComments.length > 0 && <span style={{ marginLeft: 6, fontWeight: 400 }}>({sectionComments.length})</span>}
                  </div>
                  <CommentThread proposalId={id} sectionName={sectionName} initialComments={sectionComments} currentUserId={user.id} />
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
