import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/server';
import { Search, Library, Star, Plus, Tag, Copy, Trash2 } from 'lucide-react';
import { createSnippet, deleteSnippet } from './actions';

const CATEGORIES = [
  { value: 'past_performance', label: 'Past Performance' },
  { value: 'technical', label: 'Technical Approach' },
  { value: 'management', label: 'Management Plan' },
  { value: 'qualifications', label: 'Qualifications' },
  { value: 'price', label: 'Price / Cost' },
  { value: 'boilerplate', label: 'Boilerplate' },
  { value: 'general', label: 'General' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  past_performance: '#00C48C',
  technical: '#2F80FF',
  management: '#7B61FF',
  qualifications: '#F59E0B',
  price: '#FF4D4F',
  boilerplate: '#94A3B8',
  general: '#475569',
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();

  // Fetch user's content snippets
  let snippetsQuery = (supabase as any)
    .from('content_snippets')
    .select('id, title, body, category, tags, naics_codes, quality_score, use_count, created_at')
    .eq('user_id', user?.id)
    .order('use_count', { ascending: false });

  if (category && category !== 'all') snippetsQuery = snippetsQuery.eq('category', category);

  const { data: snippetsRaw } = await snippetsQuery.limit(50);
  let snippets: any[] = snippetsRaw ?? [];

  // Filter by keyword search client-accessible from server (no FTS available without DB fn)
  if (q) {
    const lower = q.toLowerCase();
    snippets = snippets.filter(
      (s: any) =>
        s.title?.toLowerCase().includes(lower) ||
        s.body?.toLowerCase().includes(lower) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(lower)),
    );
  }

  // Also pull past_performance as read-only library items
  const { data: pastPerf } = await supabase
    .from('past_performance')
    .select('id, contract_title, scope_narrative, naics_codes, customer_name, cpars_rating')
    .order('created_at', { ascending: false })
    .limit(24);

  const ratingScore: Record<string, number> = {
    exceptional: 98, very_good: 85, satisfactory: 72, marginal: 55, unsatisfactory: 30,
  };

  const ppItems = (pastPerf ?? [])
    .filter(() => !category || category === 'all' || category === 'past_performance')
    .filter((pp: any) => {
      if (!q) return true;
      const lower = q.toLowerCase();
      return (
        pp.contract_title?.toLowerCase().includes(lower) ||
        pp.scope_narrative?.toLowerCase().includes(lower)
      );
    })
    .map((pp: any) => ({
      id: `pp-${pp.id}`,
      isPastPerf: true,
      title: pp.contract_title ?? 'Untitled',
      category: 'past_performance',
      tags: [...(pp.naics_codes ?? []).slice(0, 2), pp.customer_name].filter(Boolean),
      qualityScore: ratingScore[pp.cpars_rating ?? ''] ?? 80,
      useCount: 0,
      preview: pp.scope_narrative?.substring(0, 140) ?? '',
    }));

  const snippetItems = snippets.map((s: any) => ({
    id: s.id,
    isPastPerf: false,
    title: s.title,
    category: s.category,
    tags: s.tags ?? [],
    qualityScore: s.quality_score ?? null,
    useCount: s.use_count ?? 0,
    preview: s.body?.substring(0, 140) ?? '',
  }));

  const allItems = [...snippetItems, ...ppItems];
  const totalCount = allItems.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Content Library</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{totalCount} assets</p>
        </div>
        <button
          onClick={undefined}
          style={{ display: 'none' }}
        />
      </div>

      {/* Add snippet form */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Add Content Snippet</div>
        <form action={createSnippet}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>TITLE</label>
              <input name="title" placeholder="e.g. Past Performance — HQ Renovation" required
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>CATEGORY</label>
              <select name="category"
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff', boxSizing: 'border-box' as const }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>CONTENT</label>
            <textarea name="body" placeholder="Paste or write your reusable content here..." required rows={4}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0F172A', outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>TAGS (comma-separated)</label>
              <input name="tags" placeholder="renovation, federal, design-build"
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>NAICS CODES (comma-separated)</label>
              <input name="naics_codes" placeholder="236220, 236210"
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <button type="submit"
            style={{ background: '#2F80FF', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} strokeWidth={1.5} />Save Snippet
          </button>
        </form>
      </div>

      {/* Search + filter bar */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <Search size={15} strokeWidth={1.5} style={{ color: '#94A3B8' }} />
        <form style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input name="q" defaultValue={q} placeholder="Search by keyword, NAICS, tag..."
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, color: '#0F172A', outline: 'none' }} />
          <button type="submit" style={{ fontSize: 12, fontWeight: 600, color: '#2F80FF', background: 'none', border: 'none', cursor: 'pointer' }}>Search</button>
        </form>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' as const }}>
        {[{ value: 'all', label: 'All' }, ...CATEGORIES].map(c => {
          const isActive = (!category && c.value === 'all') || category === c.value;
          return (
            <a key={c.value} href={c.value === 'all' ? '/library' : `/library?category=${c.value}`}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, textDecoration: 'none',
                background: isActive ? '#2F80FF' : '#F8FAFC',
                color: isActive ? '#fff' : '#475569',
                border: isActive ? '1px solid #2F80FF' : '1px solid #E2E8F0' }}>
              {c.label}
            </a>
          );
        })}
      </div>

      {/* Grid */}
      {allItems.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {allItems.map(item => (
            <div key={item.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  color: CATEGORY_COLORS[item.category] ?? '#475569',
                  background: `${CATEGORY_COLORS[item.category] ?? '#475569'}14`,
                  padding: '2px 6px', borderRadius: 4
                }}>
                  {CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.useCount > 0 && (
                    <span style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Copy size={9} strokeWidth={1.5} />{item.useCount}x
                    </span>
                  )}
                  {item.qualityScore != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={10} strokeWidth={1.5} style={{ color: '#2F80FF' }} />{item.qualityScore}
                    </span>
                  )}
                  {!item.isPastPerf && (
                    <form action={deleteSnippet.bind(null, item.id)}>
                      <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 6, lineHeight: 1.35 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 10,
                overflow: 'hidden', display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {item.preview}
              </div>
              {item.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                  {item.tags.slice(0, 4).map((tag: string) => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', background: '#F8FAFC',
                      border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Tag size={8} strokeWidth={1.5} />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' as const, padding: '48px', color: '#94A3B8' }}>
          <Library size={32} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#E2E8F0', display: 'block' }} />
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>No content found</p>
          <p style={{ fontSize: 13 }}>Add snippets above or add past performance records.</p>
        </div>
      )}
    </div>
  );
}
