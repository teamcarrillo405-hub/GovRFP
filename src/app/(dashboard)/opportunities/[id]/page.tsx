import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { getProfile } from '@/app/(dashboard)/profile/actions'
import { scoreOpportunity, matchLabel, type MatchBreakdown } from '@/lib/matching/opportunity-scorer'
import type { ProfileFormData } from '@/lib/validators/profile'
import { fetchFpdsAwardsByAgency } from '@/lib/fpds/fetch'
import type { FpdsSearchResult } from '@/lib/fpds/types'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { SizeEligibilityPanel } from '@/components/sba/SizeEligibilityPanel'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Opportunity ${id} — GovTool` }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string
  title: string | null
  agency: string | null
  agency_name: string | null
  naics_code: string | null
  set_aside: string | null
  set_aside_description: string | null
  due_date: string | null
  response_deadline: string | null
  estimated_value: number | null
  match_score: number | null
  solicitation_number: string | null
  description_text: string | null
  description: string | null
  pop_city: string | null
  pop_state: string | null
  place_of_performance_state: string | null
  posted_date: string | null
  point_of_contact: string | null
  sam_url: string | null
  ui_link: string | null
  notice_type: string | null
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
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysRemaining(due: string | null): number | null {
  if (!due) return null
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DarkMetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12,
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid rgba(192,194,198,0.08)',
      alignItems: 'start',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#C0C2C6', textTransform: 'uppercase' as const, letterSpacing: '0.10em', fontFamily: "'IBM Plex Mono', monospace" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  )
}

function ScoreBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF1A1A', fontFamily: "'IBM Plex Mono', monospace" }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(192,194,198,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #FF1A1A, #FF4D4F)', borderRadius: 2 }} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  let opportunity: Opportunity | null = null
  try {
    const { data } = await supabase
      .from('opportunities' as any)
      .select('id, title, agency, agency_name, naics_code, set_aside, set_aside_description, due_date, response_deadline, estimated_value, match_score, solicitation_number, description_text, description, pop_city, pop_state, place_of_performance_state, posted_date, point_of_contact, sam_url, ui_link, notice_type')
      .eq('id', id)
      .single()
    opportunity = data ?? null
  } catch {
    opportunity = null
  }

  if (!opportunity) notFound()

  // ── Live match score ──────────────────────────────────────────────────
  const profile = await getProfile() as Partial<ProfileFormData> | null

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
        set_aside: opportunity.set_aside ?? opportunity.set_aside_description,
        place_of_performance_state: opportunity.place_of_performance_state ?? opportunity.pop_state ?? null,
        estimated_value: opportunity.estimated_value ?? null,
        title: opportunity.title ?? null,
      },
    )
  }

  const score = breakdown ? breakdown.total : (opportunity.match_score ?? 0)
  const label = matchLabel(score)
  const labelColor =
    label === 'Strong Match' ? '#00C48C'
    : label === 'Good Match' ? '#D4AF37'
    : label === 'Moderate Match' ? '#F59E0B'
    : '#C0C2C6'

  const liveBreakdownBars = breakdown
    ? [
        { label: 'NAICS ALIGNMENT', pct: Math.round((breakdown.naics / 30) * 100) },
        { label: 'SET-ASIDE ELIGIBILITY', pct: Math.round((breakdown.set_aside / 25) * 100) },
        { label: 'GEOGRAPHIC COVERAGE', pct: Math.round((breakdown.geography / 20) * 100) },
        { label: 'CAPACITY FIT', pct: Math.round((breakdown.capacity / 15) * 100) },
        { label: 'CONSTRUCTION TYPE', pct: Math.round((breakdown.construction_type / 10) * 100) },
      ]
    : []

  const topReasons = (breakdown?.reasons ?? []).slice(0, 3)

  const days = daysRemaining(opportunity.due_date)
  const daysColor =
    days !== null && days <= 1 ? '#FF4D4F'
    : days !== null && days <= 7 ? '#F59E0B'
    : '#C0C2C6'

  const daysLabel =
    days === null ? 'No deadline'
    : days < 0 ? 'PAST DUE'
    : days === 0 ? 'DUE TODAY'
    : `T-${days}d`

  const titleTruncated =
    (opportunity.title ?? 'Untitled').length > 55
      ? (opportunity.title ?? '').substring(0, 55) + '...'
      : (opportunity.title ?? 'Untitled')

  // ── Live FPDS data ────────────────────────────────────────────────────
  let fpdsResult: FpdsSearchResult = { awards: [], totalCount: 0, source: 'fpds' }
  try {
    const agency = opportunity.agency ?? opportunity.agency_name ?? ''
    if (agency) {
      fpdsResult = await fetchFpdsAwardsByAgency(agency, opportunity.naics_code ?? null)
    }
  } catch {
    // fallback: render page with empty awards
  }

  const incumbentFound = fpdsResult.awards.some((a) => a.isIncumbent)

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#C0C2C6', marginBottom: 14, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
        <Link href="/opportunities" style={{ color: '#C0C2C6', textDecoration: 'none' }}>OPPORTUNITIES</Link>
        <span style={{ color: 'rgba(192,194,198,0.4)' }}>/</span>
        <span style={{ color: '#F5F5F7', fontWeight: 600 }}>{titleTruncated}</span>
      </div>

      {/* ── Page title ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.6)', flexShrink: 0 }} />
          <h1 style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, lineHeight: 1.3 }}>
            {opportunity.title ?? 'Untitled Opportunity'}
          </h1>
        </div>
        <p style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em', paddingLeft: 15 }}>
          {opportunity.agency ?? opportunity.agency_name ?? 'Unknown Agency'}
          {opportunity.solicitation_number ? ` · ${opportunity.solicitation_number}` : ''}
        </p>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <GlassPanel noPad style={{ marginBottom: 20, borderLeft: `2px solid ${labelColor}` }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: labelColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {score}%
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", padding: '3px 8px', borderRadius: 4, background: `${labelColor}18`, border: `1px solid ${labelColor}30`, color: labelColor, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
              {label}
            </span>
            {opportunity.set_aside && (
              <span style={{ fontSize: 9, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(192,194,198,0.08)', border: '1px solid rgba(192,194,198,0.15)', borderRadius: 4, padding: '3px 8px', letterSpacing: '0.08em' }}>
                {opportunity.set_aside}
              </span>
            )}
            <span style={{ fontSize: 9, color: daysColor, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, letterSpacing: '0.08em' }}>
              {daysLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link
              href="/pipeline"
              style={{ background: 'transparent', border: '1px solid rgba(192,194,198,0.25)', borderRadius: 6, padding: '8px 16px', fontSize: 10, fontWeight: 700, color: '#C0C2C6', textDecoration: 'none', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}
            >
              PIPELINE
            </Link>
            <Link
              href={`/proposals/new?opportunity_id=${opportunity.id}`}
              style={{ background: '#FF1A1A', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 10, fontWeight: 700, textDecoration: 'none', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const, boxShadow: '0 0 16px rgba(255,26,26,0.3)' }}
            >
              START PROPOSAL
            </Link>
          </div>
        </div>
      </GlassPanel>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ══ LEFT COLUMN ════════════════════════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Opportunity Details */}
          <GlassPanel noPad>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(192,194,198,0.08)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                OPPORTUNITY DETAILS
              </span>
            </div>
            <div style={{ padding: '4px 18px 16px' }}>
              <DarkMetaRow label="Solicitation No." value={opportunity.solicitation_number ?? '—'} />
              <DarkMetaRow label="Notice Type" value={opportunity.notice_type ?? 'Sources Sought'} />
              <DarkMetaRow label="NAICS Code" value={opportunity.naics_code ?? '—'} />
              <DarkMetaRow label="Set-Aside" value={opportunity.set_aside ?? opportunity.set_aside_description ?? 'Unrestricted'} />
              <DarkMetaRow label="Posted Date" value={formatDate(opportunity.posted_date)} />
              <DarkMetaRow label="Response Deadline" value={formatDate(opportunity.due_date ?? opportunity.response_deadline)} />
              <DarkMetaRow label="Place of Performance" value={[opportunity.pop_city, opportunity.place_of_performance_state ?? opportunity.pop_state].filter(Boolean).join(', ') || '—'} />
              <DarkMetaRow label="Est. Value" value={formatValue(opportunity.estimated_value)} />
              <DarkMetaRow label="Point of Contact" value={opportunity.point_of_contact ?? '—'} last />
            </div>
          </GlassPanel>

          {/* Prior Awards — Incumbent Detection */}
          <GlassPanel noPad>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(192,194,198,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                PRIOR AWARDS — INCUMBENT DETECTION
              </span>
              {fpdsResult.awards.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(192,194,198,0.08)', border: '1px solid rgba(192,194,198,0.15)', borderRadius: 4, padding: '2px 8px', letterSpacing: '0.08em' }}>
                  {fpdsResult.totalCount} RECORDS
                </span>
              )}
            </div>
            <div style={{ padding: '14px 18px' }}>
              {fpdsResult.awards.length === 0 ? (
                <div style={{ fontSize: 12, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace" }}>
                  No prior award history found in federal database for this agency.
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: 'rgba(192,194,198,0.12)' }} />
                  {fpdsResult.awards.map((award, idx) => (
                    <div key={award.awardId} style={{ display: 'flex', gap: 16, paddingBottom: idx < fpdsResult.awards.length - 1 ? 20 : 0, position: 'relative' }}>
                      <div style={{ width: 15, height: 15, borderRadius: '50%', background: award.isIncumbent ? '#FF1A1A' : 'rgba(192,194,198,0.2)', border: `1px solid ${award.isIncumbent ? '#FF1A1A' : 'rgba(192,194,198,0.3)'}`, flexShrink: 0, marginTop: 2, zIndex: 1, boxShadow: award.isIncumbent ? '0 0 8px rgba(255,26,26,0.4)' : 'none' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{award.awardeeName}</span>
                          {award.isIncumbent && (
                            <span style={{ fontSize: 9, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,26,26,0.12)', color: '#FF4D4F', border: '1px solid rgba(255,26,26,0.25)' }}>
                              INCUMBENT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6' }}>
                          ${award.awardAmount.toLocaleString()} · {award.awardDate ? award.awardDate.slice(0, 10) : '—'}
                          {award.naicsCode ? ` · NAICS ${award.naicsCode}` : ''}
                        </div>
                        {award.description && (
                          <div style={{ fontSize: 11, color: 'rgba(192,194,198,0.6)', marginTop: 2 }}>
                            {award.description.slice(0, 100)}{award.description.length > 100 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {incumbentFound && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11, color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em', lineHeight: 1.5 }}>
                  ADVISORY: Incumbent identified. Expect an experienced competitor with incumbency advantage. Highlight differentiation in your technical approach.
                </div>
              )}
            </div>
          </GlassPanel>

          {/* Scope of Work */}
          <GlassPanel noPad>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(192,194,198,0.08)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                SCOPE OF WORK
              </span>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {(opportunity.description_text ?? opportunity.description)
                ? (opportunity.description_text ?? opportunity.description)!.split('\n').filter(Boolean).map((para, i) => (
                    <p key={i} style={{ fontSize: 13, color: '#C0C2C6', lineHeight: 1.7, margin: '0 0 10px' }}>{para}</p>
                  ))
                : (
                  <p style={{ fontSize: 12, color: '#C0C2C6', lineHeight: 1.7, fontFamily: "'IBM Plex Mono', monospace" }}>
                    No scope description available. View the full solicitation on SAM.gov for details.
                    {(opportunity.sam_url || opportunity.ui_link) && (
                      <> {' '}<a href={opportunity.sam_url ?? opportunity.ui_link ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#FF1A1A', textDecoration: 'none', fontWeight: 700 }}>Open on SAM.gov</a></>
                    )}
                  </p>
                )
              }
            </div>
          </GlassPanel>

        </div>

        {/* ══ RIGHT SIDEBAR ═══════════════════════════════════════════════ */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Match Score */}
          <GlassPanel noPad variant="accent">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,26,26,0.12)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                YOUR MATCH SCORE
              </span>
            </div>
            <div style={{ padding: '20px 16px 16px' }}>
              <div style={{ textAlign: 'center' as const, marginBottom: 20 }}>
                <div style={{ fontSize: 54, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: labelColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {score}%
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: labelColor, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  {label}
                </div>
              </div>
              {liveBreakdownBars.map((item) => (
                <ScoreBar key={item.label} label={item.label} pct={item.pct} />
              ))}
              {topReasons.length > 0 && (
                <div style={{ marginBottom: 14, marginTop: 4 }}>
                  {topReasons.map((reason, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.5, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ flexShrink: 0, color: '#FF1A1A', marginTop: 1 }}>&#x25B8;</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href={`/proposals/new?opportunity_id=${opportunity.id}`}
                style={{ display: 'block', background: '#FF1A1A', color: '#fff', borderRadius: 6, padding: '10px 0', fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const, boxShadow: '0 0 16px rgba(255,26,26,0.25)' }}
              >
                START PROPOSAL
              </Link>
            </div>
          </GlassPanel>

          {/* SBA Size Eligibility */}
          <SizeEligibilityPanel
            naics={opportunity.naics_code}
            annualRevenueUsd={profile?.annual_revenue_usd ?? null}
            employeeCount={profile?.employee_count ?? null}
            sbaCategory={profile?.sba_size_category ?? null}
          />

          {/* External SAM.gov link */}
          {(opportunity.sam_url || opportunity.ui_link) && (
            <GlassPanel noPad>
              <a
                href={opportunity.sam_url ?? opportunity.ui_link ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', textDecoration: 'none' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C0C2C6', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  VIEW ON SAM.GOV
                </span>
                <span style={{ color: '#FF1A1A', fontSize: 14 }}>&rarr;</span>
              </a>
            </GlassPanel>
          )}

        </div>
      </div>
    </div>
  )
}
