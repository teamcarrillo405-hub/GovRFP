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

  const GLASS = { background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 10 } as const

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link href={`/proposals/${id}/editor`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'rgba(192,194,198,0.45)', textDecoration: 'none', fontSize: 12 }}>
          <ChevronLeft size={14} strokeWidth={1.5} />{proposal.title}
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', margin: 0 }}>SME Task Board</h1>
        <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.45)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4, marginBottom: 0 }}>
          {totalCount} requirements · {assignedCount} assigned · {completeCount} complete
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ ...GLASS, padding: '16px 24px', display: 'flex', gap: 36, marginBottom: 24 }}>
        <StatPill label="Total" value={totalCount} color="rgba(192,194,198,0.7)" />
        <StatPill label="Assigned" value={assignedCount} color="#2F80FF" />
        <StatPill label="In Progress" value={inProgressCount} color="#F59E0B" />
        <StatPill label="Complete" value={completeCount} color="#00C48C" />
      </div>

      {allTopics.length === 0 && (
        <div style={{ ...GLASS, padding: '48px 24px', textAlign: 'center', fontSize: 13, color: 'rgba(192,194,198,0.45)' }}>
          No requirements found. Run RFP analysis first.
        </div>
      )}

      {allTopics.map((topic) => {
        const reqs = grouped.get(topic) ?? []
        return (
          <div key={topic} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)', marginBottom: 8, paddingLeft: 4 }}>
              {topic}
            </div>

            <div style={{ ...GLASS, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 190px 130px 110px', padding: '8px 16px', borderBottom: '1px solid rgba(192,194,198,0.08)', background: 'rgba(11,11,13,0.3)' }}>
                {['Req ID', 'Requirement', 'Class.', 'Assignee', 'Status', 'Section'].map((col) => (
                  <div key={col} style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.4)', padding: '0 8px' }}>
                    {col}
                  </div>
                ))}
              </div>

              {reqs.map((req, idx) => {
                const assignment = assignmentMap.get(req.id)
                const currentAssigneeId = assignment?.assignee_id ?? ''
                const currentStatus = assignment?.status ?? 'pending'
                const isMandatory = req.classification === 'mandatory'

                return (
                  <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 190px 130px 110px', padding: '10px 16px', borderBottom: idx < reqs.length - 1 ? '1px solid rgba(192,194,198,0.06)' : 'none', alignItems: 'center' }}>
                    <div style={{ padding: '0 8px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(192,194,198,0.35)' }}>{req.id}</span>
                    </div>

                    <div style={{ padding: '0 8px' }}>
                      <div title={req.text} style={{ fontSize: 12, color: '#C0C2C6', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {req.text}
                      </div>
                    </div>

                    <div style={{ padding: '0 8px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em', color: isMandatory ? '#FF4D4F' : '#F59E0B', background: isMandatory ? '#FF4D4F14' : '#F59E0B14', padding: '2px 6px', borderRadius: 4 }}>
                        {isMandatory ? 'MUST' : 'SHOULD'}
                      </span>
                    </div>

                    <div style={{ padding: '0 8px' }}>
                      {teamMembers.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.25)' }}>—</span>
                      ) : (
                        <form action={async (formData: FormData) => { 'use server'; const pid = formData.get('proposalId') as string; const rid = formData.get('requirementId') as string; const aid = formData.get('assigneeId') as string; await assignRequirement(pid, rid, aid === '' ? null : aid) }} style={{ margin: 0 }}>
                          <input type="hidden" name="proposalId" value={id} />
                          <input type="hidden" name="requirementId" value={req.id} />
                          <AutoSubmitSelect name="assigneeId" defaultValue={currentAssigneeId} style={{ width: '100%', fontSize: 11, color: '#C0C2C6', border: '1px solid rgba(192,194,198,0.15)', borderRadius: 6, padding: '4px 8px', background: 'rgba(11,11,13,0.5)', cursor: 'pointer' }}>
                            <option value="">Unassigned</option>
                            {teamMembers.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email ?? m.user_id}</option>))}
                          </AutoSubmitSelect>
                        </form>
                      )}
                    </div>

                    <div style={{ padding: '0 8px' }}>
                      <form action={async (formData: FormData) => { 'use server'; const pid = formData.get('proposalId') as string; const rid = formData.get('requirementId') as string; const st = formData.get('status') as 'pending' | 'in_progress' | 'complete'; await updateRequirementStatus(pid, rid, st) }} style={{ margin: 0 }}>
                        <input type="hidden" name="proposalId" value={id} />
                        <input type="hidden" name="requirementId" value={req.id} />
                        <AutoSubmitSelect name="status" defaultValue={currentStatus} style={{ width: '100%', fontSize: 11, fontWeight: 600, color: statusColor(currentStatus), border: '1px solid rgba(192,194,198,0.15)', borderRadius: 6, padding: '4px 8px', background: 'rgba(11,11,13,0.5)', cursor: 'pointer' }}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="complete">Complete</option>
                        </AutoSubmitSelect>
                      </form>
                    </div>

                    <div style={{ padding: '0 8px' }}>
                      <span style={{ fontSize: 10, color: 'rgba(192,194,198,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{req.proposal_topic}</span>
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

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)' }}>{label}</span>
    </div>
  )
}
