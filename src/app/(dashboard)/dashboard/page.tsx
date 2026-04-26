import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BarChart2, FileText, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: '#00C48C',
    processing: '#2F80FF',
    draft: '#475569',
    archived: '#475569',
  };
  const color = map[status] ?? '#475569';
  const labels: Record<string, string> = {
    ready: 'Ready',
    processing: 'Processing',
    draft: 'Draft',
    archived: 'Archived',
  };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}14`, padding: '2px 7px', borderRadius: 4 }}>
      {labels[status] ?? status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const activeCount = proposals?.filter(p => !['archived'].includes(p.status ?? '')).length ?? 0;
  const readyCount = proposals?.filter(p => p.status === 'ready').length ?? 0;
  const totalCount = proposals?.length ?? 0;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Command Center
        </h1>
        <p style={{ fontSize: 13, color: '#475569' }}>
          FY 2026 · {activeCount} active proposal{activeCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPI Strip — 4 white cards, NO colored borders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Win Rate', value: '68%', delta: '↑ 12% vs FY25', deltaColor: '#00C48C', icon: <TrendingUp size={15} strokeWidth={1.5} /> },
          { label: 'Active Proposals', value: String(activeCount), delta: `${readyCount} ready to submit`, deltaColor: '#475569', icon: <FileText size={15} strokeWidth={1.5} /> },
          { label: 'Pipeline Value', value: '$8.4M', delta: '↑ $1.2M vs last month', deltaColor: '#00C48C', icon: <DollarSign size={15} strokeWidth={1.5} /> },
          { label: 'Total Proposals', value: String(totalCount), delta: 'All time', deltaColor: '#475569', icon: <BarChart2 size={15} strokeWidth={1.5} /> },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94A3B8' }}>{kpi.icon}</span>
              {kpi.label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: kpi.deltaColor }}>{kpi.delta}</div>
          </div>
        ))}
      </div>

      {/* Recent Proposals card */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Recent Proposals</span>
          <Link href="/proposals" style={{ fontSize: 12, color: '#2F80FF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {proposals && proposals.length > 0 ? (
          proposals.slice(0, 5).map((p) => {
            const createdAt = p.created_at ? new Date(p.created_at) : null;

            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #F8FAFC', borderLeft: '2px solid #2F80FF', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/proposals/${p.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title}
                  </Link>
                </div>
                <StatusBadge status={p.status ?? 'draft'} />
                {createdAt && (
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8', flexShrink: 0 }}>
                    {createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: '#94A3B8', fontSize: 13 }}>
            No proposals yet.{' '}
            <Link href="/proposals/new" style={{ color: '#2F80FF' }}>Create your first proposal →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
