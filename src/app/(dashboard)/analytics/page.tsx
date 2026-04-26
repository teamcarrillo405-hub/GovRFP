import { createClient } from '@/lib/supabase/server';
import { TrendingUp, FileText, DollarSign, Clock } from 'lucide-react';

function BarChart({ data, title }: { data: { label: string; value: number; count: string }[]; title: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569', marginBottom: 14 }}>{title}</div>
      {data.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 80, fontSize: 11, fontWeight: 500, color: '#475569', textAlign: 'right' as const, flexShrink: 0 }}>{item.label}</div>
          <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: '100%', background: '#2F80FF', borderRadius: 4 }} />
          </div>
          <div style={{ width: 70, fontSize: 11, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>{item.value}% <span style={{ fontWeight: 400, color: '#94A3B8' }}>({item.count})</span></div>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, status, outcome, created_at')
    .order('created_at', { ascending: false });

  const total = proposals?.length ?? 0;
  const won = proposals?.filter(p => p.outcome === 'won').length ?? 0;
  const decided = proposals?.filter(p => p.outcome === 'won' || p.outcome === 'lost').length ?? 0;
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

  const agencyData = [
    { label: 'USACE', value: 82, count: '9/11' },
    { label: 'HHS', value: 75, count: '3/4' },
    { label: 'DoD', value: 71, count: '5/7' },
    { label: 'VA', value: 67, count: '2/3' },
    { label: 'GSA', value: 58, count: '7/12' },
    { label: 'EPA', value: 44, count: '4/9' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Analytics</h1>
        <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>FY 2026 · {total} proposals</p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Win Rate', value: `${winRate}%`, delta: '↑ 12% vs FY25', deltaColor: '#00C48C', icon: <TrendingUp size={15} strokeWidth={1.5} /> },
          { label: 'Proposals Won', value: `${won} of ${decided}`, delta: 'Decided', deltaColor: '#475569', icon: <FileText size={15} strokeWidth={1.5} /> },
          { label: 'Won Contract Value', value: '$12.6M', delta: '↑ $1.2M vs FY25', deltaColor: '#00C48C', icon: <DollarSign size={15} strokeWidth={1.5} /> },
          { label: 'Avg Time to Submit', value: '31 days', delta: '↓ 4 days vs FY25', deltaColor: '#00C48C', icon: <Clock size={15} strokeWidth={1.5} /> },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94A3B8' }}>{kpi.icon}</span>{kpi.label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: kpi.deltaColor }}>{kpi.delta}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px' }}>
          <BarChart data={agencyData} title="Win Rate by Agency" />
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569', marginBottom: 14 }}>Win Rate by Set-Aside</div>
          {[
            { label: 'SDVOSB', value: 77, color: '#7B61FF' },
            { label: '8(a)', value: 71, color: '#00C2FF' },
            { label: 'Unrestricted', value: 58, color: '#2F80FF' },
            { label: 'HUBZone', value: 63, color: '#00A3A3' },
          ].map(sa => (
            <div key={sa.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: sa.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: '#475569' }}>{sa.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{sa.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>AI Learning Insights</div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Based on {total} proposals across FY 2026</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { text: 'Past Performance match above 70% correlates with 89% win rate', note: '15 proposals analyzed', warning: false },
            { text: 'Proposals submitted 5+ days early win at 2.1× rate', note: 'Deadline discipline: 12 of 15 wins', warning: false },
            { text: 'Compliance score below 85 = 0% wins in FY2026', note: 'Action: check active proposals at risk', warning: true },
          ].map((insight, i) => (
            <div key={i} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', lineHeight: 1.4, marginBottom: 8 }}>{insight.text}</div>
              <div style={{ fontSize: 11, color: insight.warning ? '#F59E0B' : '#94A3B8' }}>{insight.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
