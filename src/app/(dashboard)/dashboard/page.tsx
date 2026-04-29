import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart2, FileText, DollarSign, Bell, ChevronRight, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getProfile } from '@/app/(dashboard)/profile/actions';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ArcGauge } from '@/components/ui/ArcGauge';
import { HolographicVizClient as HolographicViz } from '@/components/3d/HolographicVizClient';

function StatusBadge({ status }: { status: string }) {
  const cfgs: Record<string, { color: string; label: string }> = {
    ready:      { color: '#00C48C', label: 'READY' },
    processing: { color: '#C0C2C6', label: 'PROCESSING' },
    draft:      { color: '#475569', label: 'DRAFT' },
    archived:   { color: '#475569', label: 'ARCHIVED' },
    analyzed:   { color: '#00C48C', label: 'ANALYZED' },
    failed:     { color: '#FF4D4F', label: 'FAILED' },
  }
  const c = cfgs[status] ?? { color: '#475569', label: status.toUpperCase() }
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
      color: c.color,
      background: `${c.color}18`,
      padding: '2px 7px',
      borderRadius: 3,
      letterSpacing: '0.10em',
      border: `1px solid ${c.color}30`,
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  )
}

function fmtValue(cents: number | null): string {
  if (!cents) return '$0'
  const usd = cents / 100
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

export default async function DashboardPage() {
  const profile = await getProfile()
  if ((profile as any)?.onboarding_completed === false) redirect('/onboarding')

  const user = await getUser()
  const supabase = await createClient()

  const [
    { data: proposals },
    { data: deadlineProposals },
    { data: myTasks },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, status, created_at, contract_value, win_probability, due_date')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('proposals')
      .select('id, title, due_date, status')
      .not('due_date', 'is', null)
      .gt('due_date', new Date().toISOString())
      .lt('due_date', new Date(Date.now() + 14 * 86400000).toISOString())
      .order('due_date', { ascending: true })
      .limit(5),
    user
      ? (supabase as any)
          .from('requirement_assignments')
          .select('id, proposal_id, requirement_id, status, proposals(title)')
          .eq('assignee_id', user.id)
          .neq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase
      .from('proposals')
      .select('id, title, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(6),
  ])

  const all = proposals ?? []
  const activeCount  = all.filter(p => p.status !== 'archived').length
  const readyCount   = all.filter(p => ['ready', 'analyzed'].includes(p.status ?? '')).length
  const totalCount   = all.length
  const totalPipeline    = all.filter(p => p.contract_value != null).reduce((s, p) => s + (p.contract_value ?? 0), 0)
  const weightedPipeline = all.filter(p => p.contract_value != null && p.win_probability != null).reduce((s, p) => s + (p.contract_value ?? 0) * ((p.win_probability ?? 0) / 100), 0)

  const alerts = [
    ...(deadlineProposals ?? []).map((p: any) => {
      const daysLeft = Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000)
      return {
        type: 'deadline' as const,
        id: p.id, title: p.title,
        detail: `T-${daysLeft}D`,
        href: `/proposals/${p.id}`,
        color: daysLeft <= 3 ? '#FF4D4F' : '#F59E0B',
        icon: 'calendar' as const,
      }
    }),
    ...(myTasks?.data ?? []).map((t: any) => ({
      type: 'task' as const,
      id: t.id,
      title: t.proposals?.title ?? 'Proposal',
      detail: t.status.toUpperCase(),
      href: `/proposals/${t.proposal_id}/tasks`,
      color: '#C0C2C6',
      icon: 'task' as const,
    })),
  ]

  const winRate = (() => {
    const decided = all.filter(p => p.status === 'won' || p.status === 'lost' || (p as any).outcome === 'won' || (p as any).outcome === 'lost')
    if (decided.length === 0) return 0
    const won = decided.filter(p => p.status === 'won' || (p as any).outcome === 'won')
    return Math.round((won.length / decided.length) * 100)
  })()

  const kpis = [
    {
      label: 'Pipeline Value',
      value: fmtValue(totalPipeline),
      delta: `WTD ${fmtValue(weightedPipeline)}`,
      deltaColor: '#00C48C',
      icon: <DollarSign size={13} strokeWidth={1.5} />,
    },
    {
      label: 'Active',
      value: String(activeCount),
      delta: `${readyCount} READY`,
      deltaColor: '#C0C2C6',
      icon: <FileText size={13} strokeWidth={1.5} />,
    },
    {
      label: 'Live Alerts',
      value: String(alerts.length),
      delta: alerts.length > 0 ? 'ACTION REQ.' : 'ALL CLEAR',
      deltaColor: alerts.length > 0 ? '#FF4D4F' : '#00C48C',
      icon: <Bell size={13} strokeWidth={1.5} />,
    },
    {
      label: 'Total',
      value: String(totalCount),
      delta: 'ALL TIME',
      deltaColor: '#475569',
      icon: <BarChart2 size={13} strokeWidth={1.5} />,
    },
  ]

  return (
    <div style={{ minHeight: '100%' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 26, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, flexShrink: 0, boxShadow: '0 0 8px rgba(255,26,26,0.6)' }} />
            <h1 style={{
              fontSize: 19, fontWeight: 700,
              fontFamily: "'Oxanium', sans-serif",
              color: '#F5F5F7',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
            }}>
              SITREP
            </h1>
            <span style={{
              fontSize: 9, fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.4)',
              padding: '2px 9px',
              borderRadius: 3,
              letterSpacing: '0.14em',
            }}>
              EXEC
            </span>
          </div>
          <p style={{
            fontSize: 10.5, color: '#C0C2C6',
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.07em',
            paddingLeft: 15,
            margin: 0,
          }}>
            SITUATION REPORT · FY2026 · {activeCount} ACTIVE · {readyCount} READY
          </p>
        </div>
        {/* Win rate arc gauge */}
        <div style={{ textAlign: 'center' }}>
          <ArcGauge value={winRate} size={88} strokeWidth={6} color="#D4AF37" label="win rate" />
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {kpis.map((kpi, i) => (
          <GlassPanel key={kpi.label} variant={i === 0 ? 'accent' : 'default'} style={{ padding: '20px 22px' }}>
            <div style={{
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: '#C0C2C6',
              marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <span style={{ color: '#FF1A1A' }}>{kpi.icon}</span>
              {kpi.label}
            </div>
            <div style={{
              fontSize: 40, fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#F5F5F7',
              letterSpacing: '-0.04em',
              lineHeight: 1,
              marginBottom: 10,
            }}>
              {kpi.value}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 500,
              color: kpi.deltaColor,
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.06em',
            }}>
              {kpi.delta}
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 18 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Recent Proposals */}
          <GlassPanel noPad>
            <div style={{
              padding: '13px 20px',
              borderBottom: '1px solid rgba(192,194,198,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: "'Oxanium', sans-serif",
                color: '#F5F5F7',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>
                Recent Proposals
              </span>
              <Link href="/proposals" style={{
                fontSize: 10, color: '#FF1A1A', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3,
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.08em',
              }}>
                VIEW ALL <ChevronRight size={10} />
              </Link>
            </div>

            {all.length > 0 ? all.slice(0, 6).map((p) => {
              const dueDate  = p.due_date ? new Date(p.due_date) : null
              const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null
              const urgent   = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '11px 20px',
                  borderBottom: '1px solid rgba(192,194,198,0.06)',
                  borderLeft: `2px solid ${urgent ? '#FF4D4F' : 'rgba(255,26,26,0.38)'}`,
                  gap: 14,
                  transition: 'background 0.15s linear',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/proposals/${p.id}`} style={{
                      fontSize: 12.5, fontWeight: 600, color: '#F5F5F7',
                      textDecoration: 'none', display: 'block',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {p.title}
                    </Link>
                  </div>
                  <StatusBadge status={p.status ?? 'draft'} />
                  {dueDate && (
                    <div style={{
                      fontSize: 9.5, fontWeight: 500,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: urgent ? '#FF4D4F' : '#C0C2C6',
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Calendar size={9} strokeWidth={1.5} />
                      {daysLeft !== null && daysLeft >= 0
                        ? `T-${daysLeft}D`
                        : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  {p.contract_value && (
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: '#D4AF37',
                      fontFamily: "'IBM Plex Mono', monospace",
                      flexShrink: 0,
                    }}>
                      {fmtValue(p.contract_value)}
                    </div>
                  )}
                </div>
              )
            }) : (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#C0C2C6', fontSize: 12 }}>
                No proposals yet.{' '}
                <Link href="/proposals/new" style={{ color: '#FF1A1A' }}>Create your first →</Link>
              </div>
            )}
          </GlassPanel>

          {/* Pipeline Neural Net — gold 3D holographic viz */}
          <GlassPanel variant="gold" noPad style={{ height: 300, position: 'relative', overflow: 'hidden' }}>
            {/* HUD overlay — top left */}
            <div style={{ position: 'absolute', top: 14, left: 20, zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="hud-dot" style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#D4AF37',
                  boxShadow: '0 0 8px rgba(212,175,55,0.9)',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  fontFamily: "'Oxanium', sans-serif",
                  color: '#F5F5F7', letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                  Pipeline Neural Net
                </span>
              </div>
              <span style={{
                fontSize: 8.5, color: '#C0C2C6',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.08em',
              }}>
                VERTICES = PROPOSALS · ORBITAL ARC = WIN RATE
              </span>
            </div>

            {/* HUD corner brackets — gold */}
            <div style={{ position: 'absolute', top: 10, right: 10, width: 14, height: 14, borderTop: '1px solid rgba(212,175,55,0.5)', borderRight: '1px solid rgba(212,175,55,0.5)', zIndex: 10 }} />
            <div style={{ position: 'absolute', top: 10, left: 10,  width: 14, height: 14, borderTop: '1px solid rgba(212,175,55,0.5)', borderLeft: '1px solid rgba(212,175,55,0.5)', zIndex: 10 }} />
            <div style={{ position: 'absolute', bottom: 10, right: 10, width: 14, height: 14, borderBottom: '1px solid rgba(212,175,55,0.5)', borderRight: '1px solid rgba(212,175,55,0.5)', zIndex: 10 }} />
            <div style={{ position: 'absolute', bottom: 10, left: 10,  width: 14, height: 14, borderBottom: '1px solid rgba(212,175,55,0.5)', borderLeft: '1px solid rgba(212,175,55,0.5)', zIndex: 10 }} />

            {/* 3D canvas — passes real data */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <HolographicViz nodeCount={activeCount} winRate={winRate} />
            </div>

            {/* Bottom-right: active nodes */}
            <div style={{ position: 'absolute', bottom: 18, right: 20, zIndex: 10, textAlign: 'right' }}>
              <div style={{
                fontSize: 28, fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#D4AF37',
                lineHeight: 1,
                textShadow: '0 0 12px rgba(212,175,55,0.5)',
              }}>
                {activeCount}
              </div>
              <div style={{ fontSize: 8.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}>
                ACTIVE NODES
              </div>
            </div>

            {/* Bottom-left: weighted value */}
            <div style={{ position: 'absolute', bottom: 18, left: 20, zIndex: 10 }}>
              <div style={{
                fontSize: 18, fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#D4AF37', lineHeight: 1,
              }}>
                {fmtValue(weightedPipeline)}
              </div>
              <div style={{ fontSize: 8.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}>
                WEIGHTED PIPELINE
              </div>
            </div>

            {/* Center bottom: win rate */}
            <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: winRate >= 60 ? '#00C48C' : winRate >= 35 ? '#F59E0B' : '#C0C2C6', lineHeight: 1 }}>
                {winRate}%
              </div>
              <div style={{ fontSize: 8.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.10em' }}>
                WIN RATE
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Live Alerts */}
          <GlassPanel noPad>
            <div style={{
              padding: '13px 16px',
              borderBottom: '1px solid rgba(192,194,198,0.08)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Bell size={12} strokeWidth={1.5} style={{ color: '#FF1A1A', flexShrink: 0 }} />
              <span style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: "'Oxanium', sans-serif",
                color: '#F5F5F7',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>
                Live Alerts
              </span>
              {alerts.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: '#FF4D4F', color: '#fff',
                  padding: '1px 7px', borderRadius: 10,
                  letterSpacing: '0.06em',
                }}>
                  {alerts.length}
                </span>
              )}
            </div>
            <div style={{ padding: '4px 0' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <CheckCircle size={18} strokeWidth={1} style={{ color: '#00C48C', margin: '0 auto 8px', display: 'block' }} />
                  <div style={{
                    fontSize: 10, color: '#F5F5F7', fontWeight: 700,
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: '0.10em',
                  }}>
                    ALL CLEAR
                  </div>
                  <div style={{ fontSize: 10, color: '#C0C2C6', marginTop: 3 }}>No deadlines pending</div>
                </div>
              ) : alerts.map((alert, i) => (
                <Link
                  key={`${alert.type}-${alert.id}-${i}`}
                  href={alert.href}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(192,194,198,0.06)',
                    textDecoration: 'none',
                    transition: 'background 0.15s linear',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: 1 }}>
                    {alert.icon === 'calendar'
                      ? <AlertTriangle size={11} strokeWidth={1.5} style={{ color: alert.color }} />
                      : <Clock size={11} strokeWidth={1.5} style={{ color: alert.color }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 600, color: '#F5F5F7',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {alert.title}
                    </div>
                    <div style={{
                      fontSize: 9.5, color: alert.color, fontWeight: 500, marginTop: 1,
                      fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em',
                    }}>
                      {alert.detail}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </GlassPanel>

          {/* Activity Log */}
          <GlassPanel noPad>
            <div style={{
              padding: '13px 16px',
              borderBottom: '1px solid rgba(192,194,198,0.08)',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: "'Oxanium', sans-serif",
                color: '#F5F5F7',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>
                Activity Log
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {(recentActivity ?? []).map((p: any) => {
                const when     = new Date(p.updated_at)
                const hoursAgo = Math.floor((Date.now() - when.getTime()) / 3600000)
                const label    = hoursAgo < 1
                  ? 'LIVE'
                  : hoursAgo < 24
                  ? `${hoursAgo}H AGO`
                  : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
                return (
                  <Link
                    key={p.id}
                    href={`/proposals/${p.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px',
                      borderBottom: '1px solid rgba(192,194,198,0.06)',
                      textDecoration: 'none',
                      transition: 'background 0.15s linear',
                    }}
                  >
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: '#FF1A1A', flexShrink: 0,
                      boxShadow: '0 0 5px rgba(255,26,26,0.5)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11.5, fontWeight: 600, color: '#F5F5F7',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.title}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 9, color: '#C0C2C6', flexShrink: 0,
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '0.06em',
                    }}>
                      {label}
                    </div>
                  </Link>
                )
              })}
            </div>
          </GlassPanel>

          {/* Quick actions */}
          <GlassPanel variant="gold" style={{ padding: '16px' }}>
            <div style={{
              fontSize: 9, fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#D4AF37', letterSpacing: '0.14em',
              marginBottom: 12,
            }}>
              QUICK LAUNCH
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'New Proposal',      href: '/proposals/new' },
                { label: 'Browse Opps',       href: '/opportunities' },
                { label: 'Pipeline Board',    href: '/pipeline' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(255,26,26,0.08)',
                    border: '1px solid rgba(255,26,26,0.16)',
                    borderRadius: 6,
                    textDecoration: 'none',
                    transition: 'background 0.15s linear, border-color 0.15s linear',
                    color: '#F5F5F7',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {label}
                  <ChevronRight size={12} style={{ color: '#FF1A1A' }} />
                </Link>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
