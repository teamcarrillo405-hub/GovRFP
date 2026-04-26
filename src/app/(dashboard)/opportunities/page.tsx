import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Search, SlidersHorizontal, Calendar, Bookmark, ChevronRight } from 'lucide-react';

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  // 'opportunities' table does not exist yet — graceful empty state
  let opportunities: any[] = [];
  try {
    const { data } = await supabase
      .from('opportunities' as any)
      .select('id, title, agency, naics_code, set_aside, due_date, estimated_value, match_score, solicitation_number')
      .order('due_date', { ascending: true })
      .limit(20);
    opportunities = data ?? [];
  } catch {
    opportunities = [];
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Opportunities</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{opportunities.length} matching SAM.gov opportunities</p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#F0F2F5', borderRadius: 6, padding: '7px 12px' }}>
          <Search size={14} strokeWidth={1.5} style={{ color: '#94A3B8' }} />
          <input placeholder="Search by keyword, agency, or NAICS..." style={{ border: 'none', background: 'none', fontSize: 13, color: '#0F172A', outline: 'none', flex: 1 }} />
        </div>
        <button style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <SlidersHorizontal size={13} strokeWidth={1.5} />
          Filters
        </button>
      </div>

      {/* Opportunity cards */}
      {opportunities.length > 0 ? (
        opportunities.map((opp: any) => {
          const dueDate = opp.due_date ? new Date(opp.due_date) : null;
          const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
          const dateColor = daysLeft !== null && daysLeft <= 1 ? '#FF4D4F' : daysLeft !== null && daysLeft <= 7 ? '#F59E0B' : '#94A3B8';
          const value = opp.estimated_value ? (opp.estimated_value >= 1_000_000 ? `$${(opp.estimated_value / 1_000_000).toFixed(1)}M` : `$${(opp.estimated_value / 1_000).toFixed(0)}K`) : 'TBD';

          return (
            <div key={opp.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <Link href={`/opportunities/${opp.id}`} style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', textDecoration: 'none', display: 'block' }}>{opp.title}</Link>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{opp.agency} · {opp.solicitation_number}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#2F80FF', letterSpacing: '-0.02em' }}>{opp.match_score ?? 0}%</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Match</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: '#475569' }}>NAICS {opp.naics_code}</span>
                <span style={{ fontSize: 11, color: '#475569' }}>{opp.set_aside ?? 'Unrestricted'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>{value}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: dateColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} strokeWidth={1.5} />
                  {daysLeft !== null && daysLeft >= 0 ? `Due in ${daysLeft} days` : dueDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? '—'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bookmark size={11} strokeWidth={1.5} />Track
                  </button>
                  <Link href={`/opportunities/${opp.id}`} style={{ background: '#2F80FF', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Open in GovTool <ChevronRight size={11} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ textAlign: 'center' as const, padding: '48px 20px', color: '#94A3B8', fontSize: 13 }}>
          <Search size={32} strokeWidth={1} style={{ color: '#E2E8F0', margin: '0 auto 12px', display: 'block' }} />
          No opportunities found. Update your profile to improve matches.
        </div>
      )}
    </div>
  );
}
