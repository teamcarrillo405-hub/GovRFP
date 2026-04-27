import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import SaveSnapshotButton from './SaveSnapshotButton'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v1?: string; v2?: string; section?: string }>
}

interface SnapshotRow {
  id: string
  section_name: string
  snapshot_at: string
  label: string | null
  created_by: string | null
}

// Extract plain text from TipTap JSONContent tree
function jsonContentToText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const node = content as Record<string, unknown>

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text
  }

  const parts: string[] = []

  if (Array.isArray(node.content)) {
    for (const child of node.content as unknown[]) {
      const childText = jsonContentToText(child)
      if (childText) parts.push(childText)
    }
  }

  // Add newline after block nodes to preserve structure
  const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock'])
  const text = parts.join('')
  if (typeof node.type === 'string' && blockTypes.has(node.type)) {
    return text + '\n'
  }
  return text
}

// Very simple line-diff: returns tokens of { text, type: 'same'|'added'|'removed' }
function computeLineDiff(
  left: string,
  right: string
): { leftLines: { text: string; changed: boolean }[]; rightLines: { text: string; changed: boolean }[] } {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')
  const leftSet = new Set(leftLines)
  const rightSet = new Set(rightLines)

  return {
    leftLines: leftLines.map((line) => ({ text: line, changed: !rightSet.has(line) })),
    rightLines: rightLines.map((line) => ({ text: line, changed: !leftSet.has(line) })),
  }
}

// Group snapshot rows by date label
type DateGroup = 'Today' | 'Yesterday' | 'Earlier'
function dateGroup(dateStr: string): DateGroup {
  const d = new Date(dateStr)
  const now = new Date()
  const dayDiff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (dayDiff < 1) return 'Today'
  if (dayDiff < 2) return 'Yesterday'
  return 'Earlier'
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// A snapshot group = same snapshot_at (and label). We group by snapshot_at timestamp.
interface SnapshotGroup {
  snapshotAt: string
  label: string | null
  sections: SnapshotRow[]
  firstId: string
}

function groupBySnapshot(rows: SnapshotRow[]): SnapshotGroup[] {
  const map = new Map<string, SnapshotGroup>()
  for (const row of rows) {
    const key = row.snapshot_at
    if (!map.has(key)) {
      map.set(key, { snapshotAt: row.snapshot_at, label: row.label, sections: [], firstId: row.id })
    }
    map.get(key)!.sections.push(row)
  }
  // Sort newest first
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime()
  )
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const { id } = await params
  const { v1, v2, section } = await searchParams

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  // Load all snapshot rows for this proposal
  let snapshotRows: SnapshotRow[] = []
  try {
    const { data } = await (supabase as any)
      .from('section_versions')
      .select('id, section_name, snapshot_at, label, created_by')
      .eq('proposal_id', id)
      .order('snapshot_at', { ascending: false })
    snapshotRows = (data as SnapshotRow[]) ?? []
  } catch {
    snapshotRows = []
  }

  const snapshotGroups = groupBySnapshot(snapshotRows)

  // If v1, v2, and section set — load diff content
  let v1Text = ''
  let v2Text = ''
  let diffSectionNames: string[] = []

  if (v1 && v2) {
    // All section names in either snapshot's group
    const v1At = snapshotRows.find((r) => r.id === v1)?.snapshot_at
    const v2At = snapshotRows.find((r) => r.id === v2)?.snapshot_at
    const v1Rows = v1At ? snapshotRows.filter((r) => r.snapshot_at === v1At) : []
    const v2Rows = v2At ? snapshotRows.filter((r) => r.snapshot_at === v2At) : []
    const nameSet = new Set([...v1Rows.map((r) => r.section_name), ...v2Rows.map((r) => r.section_name)])
    diffSectionNames = Array.from(nameSet).sort()

    if (section) {
      // Load content for the selected section from both snapshots
      try {
        const [r1, r2] = await Promise.all([
          v1At
            ? (supabase as any)
                .from('section_versions')
                .select('content')
                .eq('proposal_id', id)
                .eq('snapshot_at', v1At)
                .eq('section_name', section)
                .single()
            : { data: null },
          v2At
            ? (supabase as any)
                .from('section_versions')
                .select('content')
                .eq('proposal_id', id)
                .eq('snapshot_at', v2At)
                .eq('section_name', section)
                .single()
            : { data: null },
        ])
        v1Text = jsonContentToText((r1.data as { content: unknown } | null)?.content).trim()
        v2Text = jsonContentToText((r2.data as { content: unknown } | null)?.content).trim()
      } catch {
        v1Text = ''
        v2Text = ''
      }
    }
  }

  const diff = v1 && v2 && section ? computeLineDiff(v1Text, v2Text) : null

  // Build grouped snapshot list
  const groupOrder: DateGroup[] = ['Today', 'Yesterday', 'Earlier']
  const byDateGroup: Record<DateGroup, SnapshotGroup[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  }
  for (const sg of snapshotGroups) {
    byDateGroup[dateGroup(sg.snapshotAt)].push(sg)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)', marginTop: -28, marginLeft: -28, marginRight: -28 }}>
      {/* Top bar */}
      <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
        <Link
          href={`/proposals/${id}/editor`}
          style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {proposal.title}
        </Link>
        <span style={{ color: '#E2E8F0' }}>|</span>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Version History</h1>
        <div style={{ flex: 1 }} />
        <SaveSnapshotButton proposalId={id} />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 52px - 48px)' }}>
        {/* Left: snapshot list */}
        <div style={{ width: 280, borderRight: '1px solid #E2E8F0', background: '#FAFBFC', overflowY: 'auto', flexShrink: 0 }}>
          {snapshotGroups.length === 0 ? (
            <div style={{ padding: 24, color: '#64748B', fontSize: 13, lineHeight: 1.6 }}>
              No snapshots yet. Save a snapshot to start tracking versions.
            </div>
          ) : (
            groupOrder.map((group) => {
              const items = byDateGroup[group]
              if (items.length === 0) return null
              return (
                <div key={group}>
                  <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {group}
                  </div>
                  {items.map((sg) => {
                    const isV1 = sg.sections.some((r) => r.id === v1)
                    const isV2 = sg.sections.some((r) => r.id === v2)
                    const firstRowId = sg.firstId

                    // Build next href: clicking assigns v1 first, then v2
                    let nextHref: string
                    if (!v1) {
                      nextHref = `/proposals/${id}/history?v1=${firstRowId}${v2 ? `&v2=${v2}` : ''}${section ? `&section=${encodeURIComponent(section)}` : ''}`
                    } else if (!v2) {
                      nextHref = `/proposals/${id}/history?v1=${v1}&v2=${firstRowId}${section ? `&section=${encodeURIComponent(section)}` : ''}`
                    } else {
                      // Replace v1
                      nextHref = `/proposals/${id}/history?v1=${firstRowId}&v2=${v2}${section ? `&section=${encodeURIComponent(section)}` : ''}`
                    }

                    const borderColor = isV1 ? '#2F80FF' : isV2 ? '#F59E0B' : 'transparent'

                    return (
                      <Link
                        key={sg.snapshotAt}
                        href={nextHref}
                        style={{
                          display: 'block',
                          padding: '10px 16px',
                          borderLeft: `3px solid ${borderColor}`,
                          background: (isV1 || isV2) ? (isV1 ? '#2F80FF14' : '#F59E0B14') : 'transparent',
                          textDecoration: 'none',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                          {sg.label ?? 'Auto snapshot'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', display: 'flex', gap: 6 }}>
                          <span>{formatDate(sg.snapshotAt)} {formatTime(sg.snapshotAt)}</span>
                          <span style={{ color: '#CBD5E1' }}>·</span>
                          <span>{sg.sections.length} section{sg.sections.length !== 1 ? 's' : ''}</span>
                        </div>
                        {(isV1 || isV2) && (
                          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: isV1 ? '#2F80FF' : '#F59E0B', letterSpacing: '0.04em' }}>
                            {isV1 ? 'VERSION A' : 'VERSION B'}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Right: comparison panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC' }}>
          {!v1 && !v2 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12, color: '#CBD5E1' }}>[ ]</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#0F172A' }}>No snapshots selected</div>
                <div>Select two snapshots from the left panel to compare them.</div>
              </div>
            </div>
          ) : v1 && !v2 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12, color: '#2F80FF' }}>A</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#0F172A' }}>Version A selected</div>
                <div>Select another snapshot to compare.</div>
              </div>
            </div>
          ) : v1 && v2 ? (
            <div style={{ padding: 24 }}>
              {/* Section tab bar */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
                {diffSectionNames.length === 0 ? (
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>No sections found in selected snapshots.</span>
                ) : (
                  diffSectionNames.map((sName) => {
                    const isActive = section === sName
                    const href = `/proposals/${id}/history?v1=${v1}&v2=${v2}&section=${encodeURIComponent(sName)}`
                    return (
                      <Link
                        key={sName}
                        href={href}
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#fff' : '#0F172A',
                          background: isActive ? '#2F80FF' : '#F1F5F9',
                          border: `1px solid ${isActive ? '#2F80FF' : '#E2E8F0'}`,
                          borderRadius: 6,
                          padding: '4px 10px',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sName}
                      </Link>
                    )
                  })
                )}
              </div>

              {!section ? (
                <div style={{ color: '#64748B', fontSize: 13 }}>
                  Select a section tab above to view the diff.
                </div>
              ) : diff ? (
                <div>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: '#64748B' }}>
                    <span>
                      <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FF4D4F14', border: '1px solid #FF4D4F', borderRadius: 2, marginRight: 4 }} />
                      Removed (Version A)
                    </span>
                    <span>
                      <span style={{ display: 'inline-block', width: 10, height: 10, background: '#00C48C14', border: '1px solid #00C48C', borderRadius: 2, marginRight: 4 }} />
                      Added (Version B)
                    </span>
                  </div>

                  {/* Side-by-side diff */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Version A */}
                    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#2F80FF', letterSpacing: '0.06em' }}>VERSION A</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>
                          {snapshotRows.find((r) => r.id === v1)
                            ? `${formatDate(snapshotRows.find((r) => r.id === v1)!.snapshot_at)} ${formatTime(snapshotRows.find((r) => r.id === v1)!.snapshot_at)}`
                            : ''}
                        </span>
                      </div>
                      <div style={{ padding: 14, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {diff.leftLines.map((line, i) => (
                          <div
                            key={i}
                            style={{
                              background: line.changed ? '#FF4D4F14' : 'transparent',
                              borderLeft: line.changed ? '3px solid #FF4D4F' : '3px solid transparent',
                              paddingLeft: 8,
                              marginLeft: -8,
                            }}
                          >
                            {line.text || '\u00a0'}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Version B */}
                    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.06em' }}>VERSION B</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>
                          {snapshotRows.find((r) => r.id === v2)
                            ? `${formatDate(snapshotRows.find((r) => r.id === v2)!.snapshot_at)} ${formatTime(snapshotRows.find((r) => r.id === v2)!.snapshot_at)}`
                            : ''}
                        </span>
                      </div>
                      <div style={{ padding: 14, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {diff.rightLines.map((line, i) => (
                          <div
                            key={i}
                            style={{
                              background: line.changed ? '#00C48C14' : 'transparent',
                              borderLeft: line.changed ? '3px solid #00C48C' : '3px solid transparent',
                              paddingLeft: 8,
                              marginLeft: -8,
                            }}
                          >
                            {line.text || '\u00a0'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
