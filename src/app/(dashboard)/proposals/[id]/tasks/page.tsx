import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import type { AnalysisRequirement } from '@/lib/analysis/types'
import { assignRequirement, updateRequirementStatus } from './actions'
import AutoSubmitSelect from './AutoSubmitSelect'

interface Props {
  params: Promise<{ id: string }>
}

interface TeamMember {
  user_id: string
  role: string | null
  email: string | null
  full_name: string | null
}

interface Assignment {
  requirement_id: string
  assignee_id: string | null
  status: 'pending' | 'in_progress' | 'complete'
}

const TOPIC_ORDER = [
  'Technical',
  'Management',
  'Past Performance',
  'Price',
  'Certifications',
  'Deliverables',
  'Other',
] as const

function statusColor(status: 'pending' | 'in_progress' | 'complete'): string {
  if (status === 'complete') return '#00C48C'
  if (status === 'in_progress') return '#F59E0B'
  return '#94A3B8'
}

function statusLabel(status: 'pending' | 'in_progress' | 'complete'): string {
  if (status === 'complete') return 'Complete'
  if (status === 'in_progress') return 'In Progress'
  return 'Pending'
}

export default async function TasksPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Load proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  // Load RFP analysis requirements
  const { data: analysisData } = await supabase
    .from('rfp_analysis')
    .select('requirements')
    .eq('proposal_id', id)
    .single()

  const requirements = ((analysisData?.requirements ?? []) as AnalysisRequirement[])

  // Load team members — try/catch since table may not exist or RLS may deny
  let teamMembers: TeamMember[] = []
  try {
    const { data: teamData } = await supabase
      .from('proposal_team')
      .select('user_id, role, email, full_name')
      .eq('proposal_id', id)
    teamMembers = (teamData ?? []) as TeamMember[]
  } catch {
    teamMembers = []
  }

  // Load assignments — try/catch since table may not exist yet
  let assignments: Assignment[] = []
  try {
    const { data: assignData } = await supabase
      .from('requirement_assignments' as any)
      .select('requirement_id, assignee_id, status')
      .eq('proposal_id', id)
    assignments = (assignData ?? []) as Assignment[]
  } catch {
    assignments = []
  }

  // Build lookup maps
  const assignmentMap = new Map<string, Assignment>()
  for (const a of assignments) {
    assignmentMap.set(a.requirement_id, a)
  }

  // Compute stats
  const totalCount = requirements.length
  const assignedCount = assignments.filter((a) => a.assignee_id != null).length
  const inProgressCount = assignments.filter((a) => a.status === 'in_progress').length
  const completeCount = assignments.filter((a) => a.status === 'complete').length

  // Group requirements by proposal_topic
  const grouped = new Map<string, AnalysisRequirement[]>()
  for (const req of requirements) {
    const topic = req.proposal_topic ?? 'Other'
    if (!grouped.has(topic)) grouped.set(topic, [])
    grouped.get(topic)!.push(req)
  }

  // Sort groups by canonical order
  const sortedTopics = TOPIC_ORDER.filter((t) => grouped.has(t))
  const extraTopics = [...grouped.keys()].filter((t) => !TOPIC_ORDER.includes(t as any))
  const allTopics = [...sortedTopics, ...extraTopics]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/proposals/${id}/editor`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: '#94A3B8',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {proposal.title}
        </Link>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
          SME Task Board
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 0 }}>
          {totalCount} requirements &middot; {assignedCount} assigned &middot; {completeCount} complete
        </p>
      </div>

      {/* Stats bar */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex',
          gap: 32,
          marginBottom: 28,
        }}
      >
        <StatPill label="Total" value={totalCount} color="#2F80FF" />
        <StatPill label="Assigned" value={assignedCount} color="#2F80FF" />
        <StatPill label="In Progress" value={inProgressCount} color="#F59E0B" />
        <StatPill label="Complete" value={completeCount} color="#00C48C" />
      </div>

      {/* Requirements table grouped by topic */}
      {allTopics.length === 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '40px 24px',
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: 14,
          }}
        >
          No requirements found. Run RFP analysis first.
        </div>
      )}

      {allTopics.map((topic) => {
        const reqs = grouped.get(topic) ?? []
        return (
          <div key={topic} style={{ marginBottom: 32 }}>
            {/* Group header */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#94A3B8',
                marginBottom: 8,
                paddingLeft: 4,
              }}
            >
              {topic}
            </div>

            {/* Table card */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 90px 190px 130px 110px',
                  gap: 0,
                  padding: '8px 16px',
                  borderBottom: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                }}
              >
                {['Req ID', 'Requirement', 'Class.', 'Assignee', 'Status', 'Section'].map((col) => (
                  <div
                    key={col}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#94A3B8',
                      padding: '0 8px',
                    }}
                  >
                    {col}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {reqs.map((req, idx) => {
                const assignment = assignmentMap.get(req.id)
                const currentAssigneeId = assignment?.assignee_id ?? ''
                const currentStatus = assignment?.status ?? 'pending'
                const isMandatory = req.classification === 'mandatory'

                return (
                  <div
                    key={req.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 90px 190px 130px 110px',
                      gap: 0,
                      padding: '10px 16px',
                      borderBottom: idx < reqs.length - 1 ? '1px solid #F1F5F9' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    {/* Req ID */}
                    <div style={{ padding: '0 8px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: '#94A3B8',
                        }}
                      >
                        {req.id}
                      </span>
                    </div>

                    {/* Requirement text */}
                    <div style={{ padding: '0 8px' }}>
                      <div
                        title={req.text}
                        style={{
                          fontSize: 13,
                          color: '#0F172A',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {req.text}
                      </div>
                    </div>

                    {/* Classification badge */}
                    <div style={{ padding: '0 8px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isMandatory ? '#FF4D4F' : '#F59E0B',
                          background: isMandatory ? '#FF4D4F14' : '#F59E0B14',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {isMandatory ? 'Mandatory' : 'Desired'}
                      </span>
                    </div>

                    {/* Assignee select */}
                    <div style={{ padding: '0 8px' }}>
                      {teamMembers.length === 0 ? (
                        <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                      ) : (
                        <form
                          action={async (formData: FormData) => {
                            'use server'
                            const pid = formData.get('proposalId') as string
                            const rid = formData.get('requirementId') as string
                            const aid = formData.get('assigneeId') as string
                            await assignRequirement(pid, rid, aid === '' ? null : aid)
                          }}
                          style={{ margin: 0 }}
                        >
                          <input type="hidden" name="proposalId" value={id} />
                          <input type="hidden" name="requirementId" value={req.id} />
                          <AutoSubmitSelect
                            name="assigneeId"
                            defaultValue={currentAssigneeId}
                            style={{
                              width: '100%',
                              fontSize: 12,
                              color: '#0F172A',
                              border: '1px solid #E2E8F0',
                              borderRadius: 6,
                              padding: '4px 8px',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">Unassigned</option>
                            {teamMembers.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.full_name ?? m.email ?? m.user_id}
                              </option>
                            ))}
                          </AutoSubmitSelect>
                          <noscript>
                            <button type="submit" style={{ marginTop: 4, fontSize: 11 }}>
                              Save
                            </button>
                          </noscript>
                        </form>
                      )}
                    </div>

                    {/* Status select */}
                    <div style={{ padding: '0 8px' }}>
                      <form
                        action={async (formData: FormData) => {
                          'use server'
                          const pid = formData.get('proposalId') as string
                          const rid = formData.get('requirementId') as string
                          const st = formData.get('status') as 'pending' | 'in_progress' | 'complete'
                          await updateRequirementStatus(pid, rid, st)
                        }}
                        style={{ margin: 0 }}
                      >
                        <input type="hidden" name="proposalId" value={id} />
                        <input type="hidden" name="requirementId" value={req.id} />
                        <AutoSubmitSelect
                          name="status"
                          defaultValue={currentStatus}
                          style={{
                            width: '100%',
                            fontSize: 12,
                            color: statusColor(currentStatus),
                            fontWeight: 600,
                            border: '1px solid #E2E8F0',
                            borderRadius: 6,
                            padding: '4px 8px',
                            background: currentStatus === 'complete'
                              ? '#00C48C14'
                              : currentStatus === 'in_progress'
                              ? '#F59E0B14'
                              : '#F8FAFC',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="pending" style={{ color: '#94A3B8', fontWeight: 400, background: '#fff' }}>
                            Pending
                          </option>
                          <option value="in_progress" style={{ color: '#F59E0B', fontWeight: 600, background: '#fff' }}>
                            In Progress
                          </option>
                          <option value="complete" style={{ color: '#00C48C', fontWeight: 600, background: '#fff' }}>
                            Complete
                          </option>
                        </AutoSubmitSelect>
                        <noscript>
                          <button type="submit" style={{ marginTop: 4, fontSize: 11 }}>
                            Save
                          </button>
                        </noscript>
                      </form>
                    </div>

                    {/* Section (proposal_topic) */}
                    <div style={{ padding: '0 8px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#94A3B8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                      >
                        {req.proposal_topic}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
    </div>
  )
}
