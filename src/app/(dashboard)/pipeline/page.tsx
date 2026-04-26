import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';

function PipelineCard({ p, showProgress }: { p: any; showProgress?: boolean }) {
  const daysLeft = (p as any).submitted_at
    ? null
    : null; // no due_date on proposals table — omit countdown
  const dateColor = '#94A3B8';
  return (
    <Link href={`/proposals/${p.id}`} style={{ display: 'block', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', marginBottom: 8, textDecoration: 'none' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.35, marginBottom: 6 }}>{p.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{p.status ?? '—'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#2F80FF', background: '#2F80FF14', padding: '2px 6px', borderRadius: 4 }}>WS —</span>
      </div>
      {showProgress && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: '65%', height: '100%', background: '#2F80FF', borderRadius: 2 }} />
          </div>
        </div>
      )}
      {p.submitted_at && (
        <div style={{ fontSize: 11, color: dateColor, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Calendar size={10} strokeWidth={1.5} />
          Submitted {new Date(p.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
    </Link>
  );
}

export default async function PipelinePage() {
  const supabase = await createClient();
  // proposals columns: id, title, status (draft|processing|ready|analyzed|failed|archived), outcome (won|lost|no_bid|pending), submitted_at
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, outcome, submitted_at, created_at')
    .order('created_at', { ascending: false });

  const all = proposals ?? [];

  // Map actual statuses to kanban columns
  const columns = [
    { label: 'Identified', items: all.filter(p => p.status === 'archived' && !p.outcome) },
    { label: 'Qualifying', items: all.filter(p => p.status === 'draft') },
    { label: 'Drafting', items: all.filter(p => ['processing', 'ready', 'analyzed'].includes(p.status ?? '')), showProgress: true },
    { label: 'Submitted', items: all.filter(p => p.status === 'failed' || p.outcome === 'won' || p.outcome === 'lost' || p.outcome === 'no_bid' || (p.submitted_at != null)) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Pipeline Board</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{all.length} active proposals</p>
        </div>
        <Link href="/proposals/new" style={{ background: '#2F80FF', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} strokeWidth={1.5} />Add Opportunity
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
        {columns.map(col => (
          <div key={col.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{col.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2F80FF', background: '#2F80FF14', padding: '2px 7px', borderRadius: 10 }}>{col.items.length}</span>
            </div>
            {col.items.map(p => <PipelineCard key={p.id} p={p} showProgress={col.showProgress} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
