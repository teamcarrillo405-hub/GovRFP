import { createClient } from '@/lib/supabase/server';
import { Search, Library, Star } from 'lucide-react';

export default async function LibraryPage() {
  const supabase = await createClient();
  // Actual columns: contract_title, scope_narrative, naics_codes (array), customer_name
  // No overall_score column — use cpars_rating as quality proxy
  const { data: pastPerf } = await supabase
    .from('past_performance')
    .select('id, contract_title, scope_narrative, naics_codes, customer_name, cpars_rating')
    .order('created_at', { ascending: false })
    .limit(24);

  const ratingScore: Record<string, number> = {
    exceptional: 98,
    very_good: 85,
    satisfactory: 72,
    marginal: 55,
    unsatisfactory: 30,
  };

  const assets = (pastPerf ?? []).map((pp: any) => ({
    id: pp.id,
    title: pp.contract_title ?? 'Untitled',
    category: 'Past Performance',
    tags: [...(pp.naics_codes ?? []).slice(0, 2), pp.customer_name].filter(Boolean),
    qualityScore: ratingScore[pp.cpars_rating ?? ''] ?? 80,
    preview: pp.scope_narrative?.substring(0, 120) ?? '',
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Content Library</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{assets.length} assets · Past Performance, Boilerplate, Technical</p>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <Search size={15} strokeWidth={1.5} style={{ color: '#94A3B8' }} />
        <input placeholder="Search content by keyword, NAICS, customer..." style={{ border: 'none', background: 'none', fontSize: 13, color: '#0F172A', outline: 'none', flex: 1 }} />
      </div>

      {assets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {assets.map(asset => (
            <div key={asset.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#2F80FF', background: '#2F80FF14', padding: '2px 6px', borderRadius: 4 }}>{asset.category}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={10} strokeWidth={1.5} style={{ color: '#2F80FF' }} />{asset.qualityScore}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 6, lineHeight: 1.3 }}>{asset.title}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{asset.preview}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                {asset.tags.map((tag: string) => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 3 }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' as const, padding: '48px', color: '#94A3B8' }}>
          <Library size={32} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#E2E8F0', display: 'block' }} />
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>No content assets yet</p>
          <p style={{ fontSize: 13 }}>Add past performance records to build your library.</p>
        </div>
      )}
    </div>
  );
}
