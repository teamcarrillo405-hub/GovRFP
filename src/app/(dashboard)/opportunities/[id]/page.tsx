import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { getProfile } from '@/app/(dashboard)/profile/actions'
import { scoreOpportunity, matchLabel, type MatchBreakdown } from '@/lib/matching/opportunity-scorer'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Opportunity ${id} — Avero GovTool` }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string
  title: string | null
  agency: string | null
  naics_code: string | null
  set_aside: string | null
  due_date: string | null
  estimated_value: number | null
  match_score: number | null
  solicitation_number: string | null
  scope_of_work: string | null
  place_of_performance: string | null
  contract_type: string | null
  posted_date: string | null
  point_of_contact: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(v: number | null): string {
  if (!v) return 'TBD'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysRemaining(due: string | null): number | null {
  if (!due) return null
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({
  children,
  color,
  size = 'sm',
}: {
  children: React.ReactNode
  color: string
  size?: 'sm' | 'xs'
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: size === 'xs' ? 10 : 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        padding: size === 'xs' ? '2px 6px' : '3px 9px',
        borderRadius: 4,
        color,
        background: `${color}14`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {children}
    </span>
  )
}

function SectionCard({
  title,
  headerRight,
  children,
  style,
}: {
  title: string
  headerRight?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid #F0F2F5',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{title}</span>
        {headerRight}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function MetaRow({
  label,
  value,
  last,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 12,
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid #F0F2F5',
        alignItems: 'start',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function ScoreBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#2F80FF' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#2F80FF',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  )
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PRIOR_AWARDS = [
  {
    id: 1,
    title: 'Road Rehabilitation Phase III',
    awardee: 'Pacific Civil Contractors, Inc.',
    value: '$4.2M',
    year: '2022',
    incumbent: true,
  },
  {
    id: 2,
    title: 'Road Rehabilitation Phase II',
    awardee: 'Southwest Infrastructure Group',
    value: '$3.8M',
    year: '2019',
    incumbent: false,
  },
  {
    id: 3,
    title: 'Road Rehabilitation Phase I',
    awardee: 'Southwest Infrastructure Group',
    value: '$2.1M',
    year: '2016',
    incumbent: false,
  },
]

const TEAMING_PARTNERS = [
  {
    id: 1,
    name: 'Apex Engineering Solutions',
    location: 'San Antonio, TX',
    fedValue: '$12.4M',
    compatibility: 92,
  },
  {
    id: 2,
    name: 'Meridian Construction Group',
    location: 'Houston, TX',
    fedValue: '$8.7M',
    compatibility: 85,
  },
  {
    id: 3,
    name: 'TrueNorth Federal LLC',
    location: 'Austin, TX',
    fedValue: '$5.1M',
    compatibility: 78,
  },
]

const COMPETITORS = [
  {
    id: 1,
    name: 'Pacific Civil Contractors, Inc.',
    role: 'Current Incumbent',
    incumbent: true,
    wins: 3,
    avgValue: '$3.9M',
  },
  {
    id: 2,
    name: 'Southwest Infrastructure Group',
    role: 'Historical Winner',
    incumbent: false,
    wins: 2,
    avgValue: '$3.0M',
  },
]

const PAST_PERFORMANCE = [
  {
    id: 1,
    title: 'Highway Median Barrier Rehabilitation',
    agency: 'FHWA — Western Division',
    contractNumber: 'DTFH70-21-C-00014',
    value: '$3.6M',
    date: '2021–2023',
    cpars: 'Exceptional',
  },
  {
    id: 2,
    title: 'Base Access Road Construction',
    agency: 'USACE — Fort Sam Houston',
    contractNumber: 'W9126G-20-C-0032',
    value: '$2.2M',
    date: '2020–2022',
    cpars: 'Very Good',
  },
]

// SCORE_BREAKDOWN is now computed live from the matching engine — see page body

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  let opportunity: Opportunity | null = null
  try {
    const { data } = await supabase
      .from('opportunities' as any)
      .select(
        'id, title, agency, naics_code, set_aside, due_date, estimated_value, match_score, solicitation_number, scope_of_work, place_of_performance, place_of_performance_state, contract_type, posted_date, point_of_contact',
      )
      .eq('id', id)
      .single()
    opportunity = data ?? null
  } catch {
    opportunity = null
  }

  if (!opportunity) notFound()

  // ── Live match score ────────────────────────────────────────────────────
  const profile = await getProfile()

  let breakdown: MatchBreakdown | null = null
  if (profile) {
    breakdown = scoreOpportunity(
      {
        certifications: profile.certifications ?? [],
        naics_codes: profile.naics_codes ?? [],
        construction_types: (profile.construction_types ?? []) as string[],
        geographic_states: profile.geographic_states ?? [],
        primary_state: profile.primary_state ?? null,
        annual_revenue_usd: profile.annual_revenue_usd ?? null,
        bonding_single_usd: profile.bonding_single_usd ?? null,
        max_project_size_usd: profile.max_project_size_usd ?? null,
        sba_size_category: profile.sba_size_category ?? null,
      },
      {
        naics_code: opportunity.naics_code,
        set_aside: opportunity.set_aside,
        place_of_performance_state: (opportunity as any).place_of_performance_state ?? null,
        estimated_value: opportunity.estimated_value ?? null,
        title: opportunity.title ?? null,
      },
    )
  }

  const score = breakdown ? breakdown.total : (opportunity.match_score ?? 0)
  const label = matchLabel(score)
  const labelColor =
    label === 'Strong Match'
      ? '#00C48C'
      : label === 'Good Match'
        ? '#2F80FF'
        : label === 'Moderate Match'
          ? '#F59E0B'
          : '#94A3B8'

  const liveBreakdownBars = breakdown
    ? [
        { label: 'NAICS Alignment', pct: Math.round((breakdown.naics / 30) * 100) },
        { label: 'Set-Aside Eligibility', pct: Math.round((breakdown.set_aside / 25) * 100) },
        { label: 'Geographic Coverage', pct: Math.round((breakdown.geography / 20) * 100) },
        { label: 'Capacity Fit', pct: Math.round((breakdown.capacity / 15) * 100) },
        { label: 'Construction Type', pct: Math.round((breakdown.construction_type / 10) * 100) },
      ]
    : [
        { label: 'NAICS Alignment', pct: 0 },
        { label: 'Set-Aside Eligibility', pct: 0 },
        { label: 'Geographic Coverage', pct: 0 },
        { label: 'Capacity Fit', pct: 0 },
        { label: 'Construction Type', pct: 0 },
      ]

  const topReasons = (breakdown?.reasons ?? []).slice(0, 3)

  const days = daysRemaining(opportunity.due_date)
  const daysColor =
    days !== null && days <= 1
      ? '#FF4D4F'
      : days !== null && days <= 7
        ? '#F59E0B'
        : '#475569'

  const daysLabel =
    days === null
      ? 'No deadline'
      : days < 0
        ? 'Past due'
        : days === 0
          ? 'Due today'
          : `${days} days remaining`

  const titleTruncated =
    (opportunity.title ?? 'Untitled').length > 55
      ? (opportunity.title ?? '').substring(0, 55) + '…'
      : (opportunity.title ?? 'Untitled')

  const incidentFound = PRIOR_AWARDS.some((a) => a.incumbent)

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#94A3B8',
            marginBottom: 14,
          }}
        >
          <Link href="/opportunities" style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 500 }}>
            Opportunities
          </Link>
          <span>/</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{titleTruncated}</span>
        </div>

        {/* Page title block */}
        <div style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.025em',
              margin: '0 0 6px',
              lineHeight: 1.25,
            }}
          >
            {opportunity.title ?? 'Untitled Opportunity'}
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            {opportunity.agency ?? 'Unknown Agency'}
            {opportunity.solicitation_number ? ` · ${opportunity.solicitation_number}` : ''}
          </p>
        </div>

        {/* Action bar */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap' as const,
          }}
        >
          {/* Left pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <Badge color="#2F80FF">{score}% Match</Badge>
            {opportunity.set_aside && (
              <Badge color="#475569">{opportunity.set_aside}</Badge>
            )}
            <Badge color={daysColor}>{daysLabel}</Badge>
          </div>

          {/* Right buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              style={{
                background: 'none',
                border: '1px solid #2F80FF',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#2F80FF',
                cursor: 'pointer',
              }}
            >
              Add to Pipeline
            </button>
            <Link
              href={`/proposals/new?opportunity=${opportunity.id}`}
              style={{
                background: '#2F80FF',
                color: '#fff',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Start Proposal
            </Link>
          </div>
        </div>

        {/* Opportunity Details card */}
        <SectionCard title="Opportunity Details" style={{ marginBottom: 20 }}>
          <MetaRow label="Solicitation Number" value={opportunity.solicitation_number ?? '—'} />
          <MetaRow label="Notice Type" value="Sources Sought / Pre-Solicitation" />
          <MetaRow label="NAICS Code" value={opportunity.naics_code ?? '—'} />
          <MetaRow label="Set-Aside Type" value={opportunity.set_aside ?? 'Unrestricted'} />
          <MetaRow label="Posted Date" value={formatDate(opportunity.posted_date)} />
          <MetaRow label="Response Deadline" value={formatDate(opportunity.due_date)} />
          <MetaRow label="Place of Performance" value={opportunity.place_of_performance ?? '—'} />
          <MetaRow label="Contract Type" value={opportunity.contract_type ?? '—'} />
          <MetaRow label="Estimated Value" value={formatValue(opportunity.estimated_value)} />
          <MetaRow
            label="Point of Contact"
            value={opportunity.point_of_contact ?? '—'}
            last
          />
        </SectionCard>

        {/* Prior Awards card */}
        <SectionCard
          title="Prior Awards"
          headerRight={
            <Badge color="#2F80FF" size="xs">
              Recompete
            </Badge>
          }
          style={{ marginBottom: 20 }}
        >
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: 7,
                top: 8,
                bottom: 8,
                width: 2,
                background: '#E2E8F0',
              }}
            />

            {PRIOR_AWARDS.map((award, idx) => (
              <div
                key={award.id}
                style={{
                  display: 'flex',
                  gap: 16,
                  paddingBottom: idx < PRIOR_AWARDS.length - 1 ? 20 : 0,
                  position: 'relative',
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: award.incumbent ? '#2F80FF' : '#CBD5E1',
                    border: award.incumbent ? '2px solid #2F80FF' : '2px solid #CBD5E1',
                    flexShrink: 0,
                    marginTop: 2,
                    zIndex: 1,
                    boxShadow: award.incumbent ? '0 0 0 3px #2F80FF22' : 'none',
                  }}
                />

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 2,
                      flexWrap: 'wrap' as const,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {award.title}
                    </span>
                    {award.incumbent && (
                      <Badge color="#2F80FF" size="xs">
                        Current Incumbent
                      </Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {award.awardee} · {award.value} · {award.year}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Amber advisory */}
          {incidentFound && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: '#F59E0B14',
                border: '1px solid #F59E0B30',
                borderRadius: 6,
                fontSize: 12,
                color: '#F59E0B',
                fontWeight: 500,
              }}
            >
              Advisory: An incumbent has been identified. Expect an experienced competitor with incumbency advantage. Highlight differentiation in your technical approach.
            </div>
          )}
        </SectionCard>

        {/* Scope of Work card */}
        <SectionCard title="Scope of Work">
          {opportunity.scope_of_work ? (
            opportunity.scope_of_work.split('\n').filter(Boolean).map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 13,
                  color: '#334155',
                  lineHeight: 1.7,
                  margin: i === 0 ? '0 0 10px' : '0 0 10px',
                }}
              >
                {para}
              </p>
            ))
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.7, margin: '0 0 10px' }}>
                This requirement encompasses the rehabilitation and maintenance of federal roadway infrastructure, including surface restoration, drainage improvements, and safety upgrades within the designated corridor. The contractor shall furnish all labor, materials, equipment, and supervision necessary to complete the work in accordance with applicable federal highway standards.
              </p>
              <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.7, margin: 0 }}>
                Work shall be performed in strict conformance with FHWA specifications, applicable state DOT standards, and all environmental permits. The period of performance is estimated at 18 months from notice to proceed. Prevailing wage rates under the Davis-Bacon Act apply to all covered classifications.
              </p>
            </div>
          )}
        </SectionCard>

      </div>

      {/* ══ RIGHT SIDEBAR ═════════════════════════════════════════════════════ */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Match Score card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F0F2F5',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            Your Match Score
          </div>
          <div style={{ padding: '20px 20px 16px' }}>
            {/* Score number */}
            <div style={{ textAlign: 'center' as const, marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: '#2F80FF',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {score}%
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: labelColor,
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>

            {/* Breakdown bars */}
            {liveBreakdownBars.map((item) => (
              <ScoreBar key={item.label} label={item.label} pct={item.pct} />
            ))}

            {/* Reason bullets */}
            {topReasons.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {topReasons.map((reason, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      lineHeight: 1.5,
                      marginBottom: 3,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 5,
                    }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1 }}>&#x2022;</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <Link
              href={`/proposals/new?opportunity=${opportunity.id}`}
              style={{
                display: 'block',
                background: '#2F80FF',
                color: '#fff',
                borderRadius: 6,
                padding: '9px 0',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                textAlign: 'center' as const,
                marginTop: 4,
              }}
            >
              Start Proposal
            </Link>
          </div>
        </div>

        {/* SBA Size Eligibility card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F0F2F5',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            SBA Size Eligibility
          </div>
          <div style={{ padding: '14px 20px' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#00C48C',
                marginBottom: 8,
              }}
            >
              Eligible — Small Business
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>NAICS Size Standard: </span>
                {opportunity.naics_code
                  ? `NAICS ${opportunity.naics_code} — $45M annual receipts`
                  : '$45M annual receipts'}
              </div>
              <div>
                <span style={{ fontWeight: 600, color: '#334155' }}>WOSB Certification: </span>
                <span style={{ color: '#00C48C', fontWeight: 600 }}>Active — Expires Dec 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Potential Teaming Partners card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F0F2F5',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            Potential Teaming Partners
          </div>
          <div style={{ padding: '8px 0' }}>
            {TEAMING_PARTNERS.map((partner, idx) => (
              <div
                key={partner.id}
                style={{
                  padding: '12px 20px',
                  borderBottom:
                    idx < TEAMING_PARTNERS.length - 1 ? '1px solid #F0F2F5' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                      {partner.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      {partner.location} · {partner.fedValue} fed
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#2F80FF',
                      flexShrink: 0,
                    }}
                  >
                    {partner.compatibility}%
                  </span>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: '1px solid #E2E8F0',
                    borderRadius: 5,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Contact
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor Intelligence card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F0F2F5',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            Competitor Intelligence
          </div>
          <div style={{ padding: '8px 0' }}>
            {COMPETITORS.map((comp, idx) => (
              <div
                key={comp.id}
                style={{
                  padding: '12px 20px',
                  borderBottom:
                    idx < COMPETITORS.length - 1 ? '1px solid #F0F2F5' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                    {comp.name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap' as const,
                  }}
                >
                  <Badge color={comp.incumbent ? '#2F80FF' : '#475569'} size="xs">
                    {comp.role}
                  </Badge>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    {comp.wins} wins · avg {comp.avgValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              margin: '0 20px 16px',
              padding: '10px 14px',
              background: '#F59E0B14',
              border: '1px solid #F59E0B30',
              borderRadius: 6,
              fontSize: 12,
              color: '#F59E0B',
              fontWeight: 500,
            }}
          >
            Advisory: Incumbent has a 3-win track record on this vehicle. A strong price-to-win analysis is recommended before submitting.
          </div>
        </div>

        {/* Matching Past Performance card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F0F2F5',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            Your Matching Past Performance
          </div>
          <div style={{ padding: '8px 0' }}>
            {PAST_PERFORMANCE.map((pp, idx) => (
              <div
                key={pp.id}
                style={{
                  padding: '12px 20px',
                  borderBottom:
                    idx < PAST_PERFORMANCE.length - 1 ? '1px solid #F0F2F5' : 'none',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                  {pp.title}
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, marginBottom: 4 }}>
                  <div>{pp.agency}</div>
                  <div>{pp.contractNumber} · {pp.value} · {pp.date}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00C48C' }}>
                  CPARS: {pp.cpars}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
