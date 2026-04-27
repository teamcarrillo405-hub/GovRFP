import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart2, FileText, DollarSign, TrendingUp, ChevronRight, Calendar, AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { getProfile } from '@/app/(dashboard)/profile/actions';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { ready: '#00C48C', processing: '#2F80FF', draft: '#475569', archived: '#475569', analyzed: '#00C48C', failed: '#FF4D4F' };
  const color = map[status] ?? '#475569';
  const labels: Record<string, string> = { ready: 'Ready', processing: 'Processing', draft: 'Draft', archived: 'Archived', analyzed: 'Analyzed', failed: 'Failed' };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}14`, padding: '2px 7px', borderRadius: 4 }}>
      {labels[status] ?? status}
    </span>
  );
}

function fmtValue(cents: number | null): string {
  if (!cents) return '$0';
  const usd = cents / 100;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

export default async function DashboardPage() {
  const profile = await getProfile();
  if ((profile as any)?.onboarding_completed === false) redirect('/onboarding');

  const user = await getUser();
  const supabase = await createClient();

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

    // Proposals with due_date within 14 days (deadline alerts)
    supabase
      .from('proposals')
      .select('id, title, due_date, status')
      .not('due_date', 'is', null)
      .gt('due_date', new Date().toISOString())
      .lt('due_date', new Date(Date.now() + 14 * 86400000).toISOString())
      .order('due_date', { ascending: true })
      .limit(5),

    // Tasks assigned to me (requirement_assignments)
    user
      ? (supabase as any)
          .from('requirement_assignments')
          .select('id, proposal_id, requirement_id, status, proposals(title)')
          .eq('assignee_id', user.id)
          .neq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),

    // Recent activity: last 5 proposals updated
    supabase
      .from('proposals')
      .select('id, title, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  const all = proposals ?? [];
  const activeCount = all.filter(p => !['archived'].includes(p.status ?? '')).length;
  const readyCount = all.filter(p => ['ready', 'analyzed'].includes(p.status ?? '')).length;
  const totalCount = all.length;

  const totalPipelineValue = all
    .filter(p => p.contract_value != null)
    .reduce((s, p) => s + (p.contract_value ?? 0), 0);

  const weightedPipelineValue = all
    .filter(p => p.contract_value != null && p.win_probability != null)
    .reduce((s, p) => s + (p.contract_value ?? 0) * ((p.win_probability ?? 0) / 100), 0);

  const alerts = [
    ...(deadlineProposals ?? []).map((p: any) => {
      const daysLeft = Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000);
      const urgent = daysLeft <= 3;
      return {
        type: 'deadline' as const,
        id: p.id,
        title: p.title,
        detail: `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        href: `/proposals/${p.id}`,
        color: urgent ? '#FF4D4F' : '#F59E0B',
        icon: 'calendar' as const,
      };
    }),
    ...(myTasks?.data ?? []).map((t: any) => ({
      type: 'task' as const,
      id: t.id,
      title: t.proposals?.title ?? 'Proposal',
      detail: `Task: ${t.requirement_id} — ${t.status}`,
      href: `/proposals/${t.proposal_id}/tasks`,
      color: '#2F80FF',
      icon: 'task' as const,
    })),
  ];

  const kpis = [
    { label: 'Pipeline Value',    value: fmtValue(totalPipelineValue),   delta: `Weighted: ${fmtValue(weightedPipelineValue)}`,   deltaColor: '#00C48C', icon: <DollarSign size={15} strokeWidth={1.5} /> },
    { label: 'Active Proposals',  value: String(activeCount),            delta: `${readyCount} ready to submit`,                  deltaColor: '#475569', icon: <FileText size={15} strokeWidth={1.5} /> },
    { label: 'Alerts',            value: String(alerts.length),          delta: alerts.length > 0 ? 'Action required' : 'All clear', deltaColor: alerts.length > 0 ? '#FF4D4F' : '#00C48C', icon: <Bell size={15} strokeWidth={1.5} /> },
    { label: 'Total Proposals',   value: String(totalCount),             delta: 'All time',                                       deltaColor: '#475569', icon: <BarChart2 size={15} strokeWidth={1.5} /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: 4 }}>Command Center</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>FY 2026 · {activeCount} active proposal{activeCount !== 1 ? 's' : ''}</p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94A3B8' }}>{kpi.icon}</span>
              {kpi.label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: kpi.deltaColor }}>{kpi.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* Recent Proposals */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Recent Proposals</span>
            <Link href="/proposals" style={{ fontSize: 12, color: '#2F80FF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {all.length > 0 ? (
            all.slice(0, 6).map((p) => {
              const dueDate = p.due_date ? new Date(p.due_date) : null;
              const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
              const urgentDue = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid #F8FAFC', borderLeft: `2px solid ${urgentDue ? '#FF4D4F' : '#2F80FF'}`, gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/proposals/${p.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </Link>
                  </div>
                  <StatusBadge status={p.status ?? 'draft'} />
                  {dueDate && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: urgentDue ? '#FF4D4F' : '#94A3B8', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Calendar size={11} strokeWidth={1.5} />
                      {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d` : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  {p.contract_value && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', flexShrink: 0 }}>
                      {fmtValue(p.contract_value)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: '#94A3B8', fontSize: 13 }}>
              No proposals yet.{' '}
              <Link href="/proposals/new" style={{ color: '#2F80FF' }}>Create your first →</Link>
            </div>
          )}
        </div>

        {/* Live Alerts sidebar */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} strokeWidth={1.5} style={{ color: '#2F80FF' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Live Alerts</span>
              {alerts.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#FF4D4F', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>{alerts.length}</span>
              )}
            </div>
            <div style={{ padding: '8px 0' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center' as const }}>
                  <CheckCircle size={20} strokeWidth={1} style={{ color: '#00C48C', margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>All clear</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>No deadlines or tasks pending</div>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <Link key={`${alert.type}-${alert.id}-${i}`} href={alert.href} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid #F8FAFC', textDecoration: 'none' }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                      {alert.icon === 'calendar'
                        ? <AlertTriangle size={13} strokeWidth={1.5} style={{ color: alert.color }} />
                        : <Clock size={13} strokeWidth={1.5} style={{ color: alert.color }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.title}</div>
                      <div style={{ fontSize: 11, color: alert.color, fontWeight: 500, marginTop: 1 }}>{alert.detail}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 16 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Recent Activity</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {(recentActivity ?? []).map((p: any) => {
                const when = new Date(p.updated_at);
                const hoursAgo = Math.floor((Date.now() - when.getTime()) / 3600000);
                const label = hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <Link key={p.id} href={`/proposals/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid #F8FAFC', textDecoration: 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2F80FF', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{label}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
