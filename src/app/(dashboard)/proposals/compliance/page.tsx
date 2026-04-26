import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { SECTION_NAMES } from '@/lib/editor/types'
import type { DraftStatus } from '@/lib/editor/types'
import { FileText, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Compliance Matrix — Avero' }

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DraftStatus | 'missing',
  { label: string; color: string }
> = {
  draft:      { label: 'Drafted',    color: '#00C48C' },
  edited:     { label: 'Edited',     color: '#00C48C' },
  generating: { label: 'Generating', color: '#F59E0B' },
  scoring:    { label: 'Scoring',    color: '#F59E0B' },
  empty:      { label: 'Empty',      color: '#FF4D4F' },
  missing:    { label: 'Missing',    color: '#FF4D4F' },
}

function getStatusConfig(status: DraftStatus | 'missing') {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.missing
}

function compliancePercent(
  sectionMap: Map<string, DraftStatus>,
): number {
  const complete = SECTION_NAMES.filter((s) => {
    const st = sectionMap.get(s)
    return st === 'draft' || st === 'edited'
  }).length
  return Math.round((complete / SECTION_NAMES.length) * 100)
}

// ─── Sub-components (all pure, no 'use client' needed) ───────────────────────

function StatusBadge({ status }: { status: DraftStatus | 'missing' }) {
  const { label, color } = getStatusConfig(status)
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        padding: '2px 7px',
        borderRadius: 4,
        color,
        background: `${color}14`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </span>
  )
}

function ComplianceBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? '#00C48C' : pct >= 40 ? '#F59E0B' : '#FF4D4F'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: '#E2E8F0',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 30, textAlign: 'right' as const }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CompliancePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Fetch all proposals for the user (RLS enforces ownership / team membership)
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })

  // Fetch all proposal_sections for this user's proposals in one query
  const proposalIds = (proposals ?? []).map((p) => p.id)

  let allSections: Array<{
    proposal_id: string
    section_name: string
    draft_status: DraftStatus
  }> = []

  if (proposalIds.length > 0) {
    const { data: sections } = await supabase
      .from('proposal_sections')
      .select('proposal_id, section_name, draft_status')
      .in('proposal_id', proposalIds)

    allSections = (sections ?? []) as typeof allSections
  }

  // Build a lookup: proposalId -> Map<sectionName, DraftStatus>
  const sectionsByProposal = new Map<string, Map<string, DraftStatus>>()
  for (const row of allSections) {
    let map = sectionsByProposal.get(row.proposal_id)
    if (!map) {
      map = new Map()
      sectionsByProposal.set(row.proposal_id, map)
    }
    map.set(row.section_name, row.draft_status)
  }

  const hasProposals = (proposals?.length ?? 0) > 0

  return (
    <div style={{ minHeight: '100%' }}>
      {/* ── Page header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            Compliance Matrix
          </h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 0 }}>
            Track section completion across all proposals
          </p>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            paddingTop: 4,
          }}
        >
          {(
            [
              { label: 'Drafted', color: '#00C48C' },
              { label: 'In Progress', color: '#F59E0B' },
              { label: 'Missing', color: '#FF4D4F' },
            ] as const
          ).map(({ label, color }) => (
            <span
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  display: 'inline-block',
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Matrix card ── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          overflow: 'auto',
        }}
      >
        {hasProposals ? (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            {/* Column headers */}
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {/* Sticky proposal column */}
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    background: '#F8FAFC',
                    padding: '10px 16px',
                    textAlign: 'left' as const,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.10em',
                    color: '#475569',
                    borderBottom: '1px solid #E2E8F0',
                    whiteSpace: 'nowrap' as const,
                    minWidth: 220,
                    boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                  }}
                >
                  Proposal
                </th>

                {/* Section columns */}
                {SECTION_NAMES.map((name) => (
                  <th
                    key={name}
                    style={{
                      padding: '10px 10px',
                      textAlign: 'center' as const,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      color: '#475569',
                      borderBottom: '1px solid #E2E8F0',
                      whiteSpace: 'nowrap' as const,
                      minWidth: 100,
                    }}
                  >
                    {name}
                  </th>
                ))}

                {/* Compliance + action columns */}
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'center' as const,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.10em',
                    color: '#475569',
                    borderBottom: '1px solid #E2E8F0',
                    whiteSpace: 'nowrap' as const,
                    minWidth: 140,
                  }}
                >
                  Completion
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'center' as const,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.10em',
                    color: '#475569',
                    borderBottom: '1px solid #E2E8F0',
                    whiteSpace: 'nowrap' as const,
                    minWidth: 100,
                  }}
                >
                  Editor
                </th>
              </tr>
            </thead>

            <tbody>
              {(proposals ?? []).map((proposal, rowIdx) => {
                const sectionMap = sectionsByProposal.get(proposal.id) ?? new Map<string, DraftStatus>()
                const pct = compliancePercent(sectionMap)
                const createdDate = proposal.created_at
                  ? new Date(proposal.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'

                return (
                  <tr
                    key={proposal.id}
                    style={{
                      borderBottom:
                        rowIdx < (proposals?.length ?? 0) - 1
                          ? '1px solid #F1F5F9'
                          : 'none',
                    }}
                  >
                    {/* Sticky proposal name cell */}
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                        background: '#fff',
                        padding: '12px 16px',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                        borderRight: '1px solid #F1F5F9',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: '#0F172A',
                          fontSize: 13,
                          marginBottom: 2,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap' as const,
                        }}
                        title={proposal.title}
                      >
                        {proposal.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{createdDate}</div>
                    </td>

                    {/* Section status cells */}
                    {SECTION_NAMES.map((name) => {
                      const st = (sectionMap.get(name) ?? 'missing') as DraftStatus | 'missing'
                      return (
                        <td
                          key={name}
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center' as const,
                            verticalAlign: 'middle',
                          }}
                        >
                          <StatusBadge status={st} />
                        </td>
                      )
                    })}

                    {/* Completion bar */}
                    <td
                      style={{
                        padding: '12px 16px',
                        verticalAlign: 'middle',
                      }}
                    >
                      <ComplianceBar pct={pct} />
                    </td>

                    {/* Open Editor link */}
                    <td
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center' as const,
                        verticalAlign: 'middle',
                      }}
                    >
                      <Link
                        href={`/proposals/${proposal.id}/editor`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#2F80FF',
                          textDecoration: 'none',
                          padding: '4px 10px',
                          border: '1px solid #2F80FF',
                          borderRadius: 5,
                        }}
                      >
                        <ExternalLink size={11} strokeWidth={1.5} />
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* Empty state */
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center' as const,
            }}
          >
            <FileText
              size={36}
              strokeWidth={1}
              style={{ color: '#E2E8F0', margin: '0 auto 14px', display: 'block' }}
            />
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#0F172A',
                marginBottom: 6,
              }}
            >
              No proposals yet
            </p>
            <p
              style={{
                fontSize: 13,
                color: '#475569',
                marginBottom: 20,
              }}
            >
              Create your first proposal to start tracking compliance.
            </p>
            <Link
              href="/proposals/new"
              style={{
                background: '#2F80FF',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              New Proposal
            </Link>
          </div>
        )}
      </div>

      {/* Summary footer strip */}
      {hasProposals && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 24,
            fontSize: 12,
            color: '#475569',
          }}
        >
          <span>
            <strong style={{ color: '#0F172A' }}>{proposals?.length ?? 0}</strong> proposals
          </span>
          <span>
            <strong style={{ color: '#0F172A' }}>{SECTION_NAMES.length}</strong> tracked sections
          </span>
          <span>
            <strong style={{ color: '#0F172A' }}>
              {(proposals ?? []).filter((p) => {
                const m = sectionsByProposal.get(p.id) ?? new Map()
                return compliancePercent(m) === 100
              }).length}
            </strong>{' '}
            fully drafted
          </span>
        </div>
      )}
    </div>
  )
}
