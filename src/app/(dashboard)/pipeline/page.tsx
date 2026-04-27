import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Calendar, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>Win probability</span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function PipelineCard({ p }: { p: any }) {
  const dueDate = p.due_date ? new Date(p.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
  const urgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;

  return (
    <Link href={`/proposals/${p.id}`} style={{ display: 'block', background: '#fff', border: `1px solid ${urgent ? '#FF4D4F40' : '#E2E8F0'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, textDecoration: 'none' }}>
      {urgent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <AlertTriangle size={10} strokeWidth={1.5} style={{ color: '#FF4D4F' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FF4D4F' }}>Due in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.35, marginBottom: 6 }}>{p.title}</div>

      <ProbabilityBar pct={p.win_probability} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#0F172A' }}>
          <DollarSign size={10} strokeWidth={1.5} style={{ color: '#2F80FF' }} />
          {fmtValue(p.contract_value)}
        </div>
        {dueDate && !urgent && (
          <div style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Calendar size={9} strokeWidth={1.5} />
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
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

  // Columns mapped to lifecycle stages
  const columns = [
    { label: 'Identified',  items: all.filter(p => p.status === 'archived' && !p.outcome) },
    { label: 'Qualifying',  items: all.filter(p => p.status === 'draft') },
    { label: 'Drafting',    items: all.filter(p => ['processing', 'ready', 'analyzed'].includes(p.status ?? '')) },
    { label: 'Submitted',   items: all.filter(p => p.outcome != null || p.submitted_at != null) },
  ];

  // Capacity warning: if drafting column has more than 5 open proposals
  const draftingCount = columns[2].items.length;
  const capacityWarning = draftingCount > 5;

  // Total pipeline value (contract_value stored as cents)
  const totalValue = all
    .filter(p => p.contract_value != null)
    .reduce((sum, p) => sum + (p.contract_value ?? 0), 0);

  // Weighted pipeline (value × win_probability)
  const weightedValue = all
    .filter(p => p.contract_value != null && p.win_probability != null)
    .reduce((sum, p) => sum + (p.contract_value ?? 0) * ((p.win_probability ?? 0) / 100), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Pipeline Board</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{all.length} proposals</p>
        </div>
        <Link href="/proposals/new" style={{ background: '#2F80FF', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} strokeWidth={1.5} />Add Opportunity
        </Link>
      </div>

      {/* Pipeline metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4 }}>TOTAL PIPELINE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{fmtValue(totalValue)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4 }}>WEIGHTED VALUE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2F80FF', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} strokeWidth={1.5} />{fmtValue(weightedValue)}
          </div>
        </div>
        <div style={{ background: '#fff', border: `1px solid ${capacityWarning ? '#FF4D4F40' : '#E2E8F0'}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: capacityWarning ? '#FF4D4F' : '#94A3B8', marginBottom: 4 }}>
            {capacityWarning ? 'CAPACITY WARNING' : 'ACTIVE DRAFTS'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: capacityWarning ? '#FF4D4F' : '#0F172A', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            {capacityWarning && <AlertTriangle size={16} strokeWidth={1.5} />}
            {draftingCount} {draftingCount === 1 ? 'proposal' : 'proposals'}
          </div>
          {capacityWarning && (
            <div style={{ fontSize: 11, color: '#FF4D4F', marginTop: 2 }}>Over 5 active — review capacity</div>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
        {columns.map(col => {
          const colValue = col.items
            .filter(p => p.contract_value != null)
            .reduce((sum, p) => sum + ((p.contract_value as number) ?? 0), 0);
          return (
            <div key={col.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{col.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {colValue > 0 && (
                    <span style={{ fontSize: 10, color: '#475569' }}>{fmtValue(colValue)}</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2F80FF', background: '#2F80FF14', padding: '2px 7px', borderRadius: 10 }}>{col.items.length}</span>
                </div>
              </div>
              {col.items.map(p => <PipelineCard key={p.id} p={p} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
