import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ArcGauge } from '@/components/ui/ArcGauge';

function fmtValue(v: number | null): string {
  if (!v) return '—';
  if (v >= 100000000) return `$${(v / 100000000).toFixed(1)}M`;
  if (v >= 100000) return `$${(v / 100000).toFixed(0)}K`;
  return `$${(v / 100).toFixed(0)}`;
}

function ProbabilityBar({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const color = pct >= 70 ? '#00C48C' : pct >= 40 ? '#F59E0B' : '#FF4D4F';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>WIN PROB</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(192,194,198,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function PipelineCard({ p }: { p: any }) {
  const dueDate = p.due_date ? new Date(p.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
  const urgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const borderColor = urgent ? '#FF4D4F' : daysLeft !== null && daysLeft <= 14 ? '#F59E0B' : 'rgba(192,194,198,0.15)';
  const winPct = p.win_probability ?? null;
  const gaugeColor = winPct !== null
    ? (winPct >= 70 ? '#00C48C' : winPct >= 40 ? '#F59E0B' : '#FF4D4F')
    : '#FF1A1A';

  const deadlineLabel =
    daysLeft !== null && daysLeft >= 0
      ? `T-${daysLeft}d`
      : dueDate
        ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

  return (
    <Link href={`/proposals/${p.id}`} style={{ display: 'block', textDecoration: 'none', marginBottom: 8 }}>
      <GlassPanel noPad style={{ borderLeft: `2px solid ${borderColor}`, overflow: 'hidden' }}>
        {/* Urgent top bar */}
        {urgent && (
          <div style={{ height: 3, background: '#FF4D4F', width: '100%' }} />
        )}

        {/* Card header: title + gauge */}
        <div style={{ padding: '11px 13px 8px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {urgent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <AlertTriangle size={9} strokeWidth={1.5} style={{ color: '#FF4D4F', flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#FF4D4F', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
                  DUE IN {daysLeft} DAY{daysLeft === 1 ? '' : 'S'}
                </span>
              </div>
            )}
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F5F5F7', lineHeight: 1.35, marginBottom: 7 }}>
              {p.title}
            </div>
            <ProbabilityBar pct={p.win_probability} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', letterSpacing: '0.02em' }}>
                {fmtValue(p.contract_value)}
              </span>
              {deadlineLabel && (
                <span style={{
                  fontSize: 9.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: urgent ? '#FF4D4F' : daysLeft !== null && daysLeft <= 14 ? '#F59E0B' : '#C0C2C6',
                  letterSpacing: '0.06em',
                  fontWeight: urgent ? 700 : 400,
                }}>
                  {deadlineLabel}
                </span>
              )}
            </div>
          </div>

          {/* Arc gauge */}
          {winPct !== null && (
            <div style={{ flexShrink: 0, marginTop: -2 }}>
              <ArcGauge value={winPct} size={56} strokeWidth={5} color={gaugeColor} glow={false} />
            </div>
          )}
        </div>
      </GlassPanel>
    </Link>
  );
}

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, outcome, submitted_at, created_at, contract_value, win_probability, due_date, naics_code')
    .order('created_at', { ascending: false });

  const all = proposals ?? [];

  const columns = [
    { label: 'IDENTIFIED',  items: all.filter(p => p.status === 'archived' && !p.outcome) },
    { label: 'QUALIFYING',  items: all.filter(p => p.status === 'draft') },
    { label: 'DRAFTING',    items: all.filter(p => ['processing', 'ready', 'analyzed'].includes(p.status ?? '')) },
    { label: 'SUBMITTED',   items: all.filter(p => p.outcome != null || p.submitted_at != null) },
  ];

  const draftingCount = columns[2].items.length;
  const capacityWarning = draftingCount > 5;

  const totalValue = all
    .filter(p => p.contract_value != null)
    .reduce((sum, p) => sum + (p.contract_value ?? 0), 0);

  const weightedValue = all
    .filter(p => p.contract_value != null && p.win_probability != null)
    .reduce((sum, p) => sum + (p.contract_value ?? 0) * ((p.win_probability ?? 0) / 100), 0);

  // Win rate: submitted proposals with a positive outcome / total submitted with an outcome
  const submittedWithOutcome = all.filter(p => p.outcome != null);
  const wins = submittedWithOutcome.filter(p => p.outcome === 'won' || p.outcome === 'awarded');
  const winRate = submittedWithOutcome.length > 0
    ? Math.round((wins.length / submittedWithOutcome.length) * 100)
    : 0;
  const winRateColor = winRate >= 70 ? '#00C48C' : winRate >= 40 ? '#F59E0B' : '#FF4D4F';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Page title */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.6)', flexShrink: 0 }} />
            <h1 style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>MISSION PIPELINE</h1>
          </div>
          <p style={{ fontSize: 10.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.07em', paddingLeft: 15, margin: '4px 0 0' }}>
            {all.length} PROPOSALS TRACKED
          </p>
        </div>
        <Link
          href="/proposals/new"
          style={{ background: '#FF1A1A', color: '#fff', borderRadius: 6, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontSize: 11, fontWeight: 700, padding: '9px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Plus size={13} strokeWidth={2} />
          ADD OPPORTUNITY
        </Link>
      </div>

      {/* KPI panels — 4 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {/* Total Pipeline */}
        <GlassPanel style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 10 }}>TOTAL PIPELINE</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{fmtValue(totalValue)}</div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.04em' }}>{all.length} active proposals</div>
        </GlassPanel>

        {/* Weighted Value */}
        <GlassPanel style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 10 }}>WEIGHTED VALUE</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{fmtValue(weightedValue)}</div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.04em' }}>probability-adjusted</div>
        </GlassPanel>

        {/* Active Drafts / Capacity Warning */}
        <GlassPanel variant={capacityWarning ? 'accent' : 'default'} style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: capacityWarning ? '#FF4D4F' : '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            {capacityWarning ? 'CAPACITY WARNING' : 'ACTIVE DRAFTS'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {capacityWarning && <AlertTriangle size={16} strokeWidth={1.5} style={{ color: '#FF4D4F', flexShrink: 0 }} />}
            <div style={{ fontSize: 34, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: capacityWarning ? '#FF4D4F' : '#F5F5F7', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {draftingCount}
            </div>
          </div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: capacityWarning ? '#FF4D4F' : '#C0C2C6', letterSpacing: '0.04em', marginTop: 6 }}>
            {capacityWarning ? 'Over 5 active — review capacity' : `${draftingCount === 1 ? 'proposal' : 'proposals'} in drafting`}
          </div>
        </GlassPanel>

        {/* Win Rate */}
        <GlassPanel style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 10 }}>WIN RATE</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: winRateColor, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>{winRate}%</div>
            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.04em' }}>
              {wins.length}/{submittedWithOutcome.length} awarded
            </div>
          </div>
          <ArcGauge value={winRate} size={60} strokeWidth={5} color={winRateColor} label="rate" glow={false} />
        </GlassPanel>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
        {columns.map(col => {
          const colValue = col.items
            .filter(p => p.contract_value != null)
            .reduce((sum, p) => sum + ((p.contract_value as number) ?? 0), 0);
          const hasItems = col.items.length > 0;

          return (
            <div key={col.label}>
              <GlassPanel noPad style={{ marginBottom: 10, borderLeft: hasItems ? '2px solid rgba(255,26,26,0.35)' : undefined, overflow: 'hidden' }}>
                <div style={{ padding: '13px 14px', borderBottom: '1px solid rgba(192,194,198,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
                    {col.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {colValue > 0 && (
                      <span style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', letterSpacing: '0.04em' }}>
                        {fmtValue(colValue)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#FF1A1A',
                      background: 'rgba(255,26,26,0.1)',
                      border: '1px solid rgba(255,26,26,0.25)',
                      padding: '2px 7px',
                      borderRadius: 3,
                      letterSpacing: '0.10em',
                    }}>
                      {col.items.length}
                    </span>
                  </div>
                </div>
              </GlassPanel>

              {col.items.map(p => <PipelineCard key={p.id} p={p} />)}

              {col.items.length === 0 && (
                <div style={{ padding: '20px 14px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 9.5, color: 'rgba(192,194,198,0.3)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
                    EMPTY
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
