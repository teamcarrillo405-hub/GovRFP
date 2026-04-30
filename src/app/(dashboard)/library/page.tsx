import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/server';
import { Search, Library, Star, Plus, Tag, Copy, Trash2 } from 'lucide-react';
import { createSnippet, deleteSnippet } from './actions';
import { GlassPanel } from '@/components/ui/GlassPanel';

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
  general: '#C0C2C6',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#C0C2C6',
  marginBottom: 12,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(192,194,198,0.15)',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: '#F5F5F7',
  background: 'rgba(11,11,13,0.6)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Inter', sans-serif",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();

  let snippetsQuery = (supabase as any)
    .from('content_snippets')
    .select('id, title, body, category, tags, naics_codes, quality_score, use_count, created_at')
    .eq('user_id', user?.id)
    .order('use_count', { ascending: false });

  if (category && category !== 'all') snippetsQuery = snippetsQuery.eq('category', category);

  const { data: snippetsRaw } = await snippetsQuery.limit(50);
  let snippets: any[] = snippetsRaw ?? [];

  if (q) {
    const lower = q.toLowerCase();
    snippets = snippets.filter(
      (s: any) =>
        s.title?.toLowerCase().includes(lower) ||
        s.body?.toLowerCase().includes(lower) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(lower)),
    );
  }

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
            Content Library
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.55)', marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
            {totalCount} assets
          </p>
        </div>
      </div>

      {/* Secondary nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <a href="/library" style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.08em',
          padding: '5px 14px',
          borderRadius: 20,
          textDecoration: 'none',
          background: '#FF1A1A',
          color: '#fff',
          border: '1px solid #FF1A1A',
        }}>
          SNIPPETS
        </a>
        <a href="/library/templates" style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.08em',
          padding: '5px 14px',
          borderRadius: 20,
          textDecoration: 'none',
          background: 'rgba(192,194,198,0.06)',
          color: 'rgba(192,194,198,0.6)',
          border: '1px solid rgba(192,194,198,0.12)',
        }}>
          TEMPLATES
        </a>
      </div>

      {/* Add snippet form */}
      <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ ...SECTION_LABEL, marginBottom: 16 }}>Add Content Snippet</div>
        <form action={createSnippet}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Title</label>
              <input name="title" placeholder="e.g. Past Performance — HQ Renovation" required style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Category</label>
              <select name="category" style={{ ...INPUT_STYLE }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Content</label>
            <textarea name="body" placeholder="Paste or write your reusable content here..." required rows={4}
              style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Tags (comma-separated)</label>
              <input name="tags" placeholder="renovation, federal, design-build" style={INPUT_STYLE} />
            </div>
            <div>
              <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>NAICS Codes (comma-separated)</label>
              <input name="naics_codes" placeholder="236220, 236210" style={INPUT_STYLE} />
            </div>
          </div>
          <button type="submit" style={{
            background: '#FF1A1A',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 18px',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.06em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Plus size={13} strokeWidth={2} />SAVE SNIPPET
          </button>
        </form>
      </GlassPanel>

      {/* Search bar */}
      <GlassPanel style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <Search size={14} strokeWidth={1.5} style={{ color: 'rgba(192,194,198,0.4)' }} />
        <form style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input name="q" defaultValue={q} placeholder="Search by keyword, NAICS, tag..."
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, color: '#F5F5F7', outline: 'none' }} />
          <button type="submit" style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', color: '#FF1A1A', background: 'none', border: 'none', cursor: 'pointer' }}>
            SEARCH
          </button>
        </form>
      </GlassPanel>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {[{ value: 'all', label: 'All' }, ...CATEGORIES].map(c => {
          const isActive = (!category && c.value === 'all') || category === c.value;
          return (
            <a key={c.value} href={c.value === 'all' ? '/library' : `/library?category=${c.value}`}
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'Oxanium', sans-serif",
                letterSpacing: '0.08em',
                padding: '4px 12px',
                borderRadius: 20,
                textDecoration: 'none',
                background: isActive ? '#FF1A1A' : 'rgba(192,194,198,0.06)',
                color: isActive ? '#fff' : 'rgba(192,194,198,0.6)',
                border: isActive ? '1px solid #FF1A1A' : '1px solid rgba(192,194,198,0.12)',
              }}>
              {c.label.toUpperCase()}
            </a>
          );
        })}
      </div>

      {/* Grid */}
      {allItems.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {allItems.map(item => (
            <GlassPanel key={item.id} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "'Oxanium', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: CATEGORY_COLORS[item.category] ?? '#C0C2C6',
                  background: `${CATEGORY_COLORS[item.category] ?? '#C0C2C6'}14`,
                  padding: '2px 7px',
                  borderRadius: 4,
                }}>
                  {CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.useCount > 0 && (
                    <span style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                      <Copy size={9} strokeWidth={1.5} />{item.useCount}x
                    </span>
                  )}
                  {item.qualityScore != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C0C2C6', display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                      <Star size={10} strokeWidth={1.5} style={{ color: '#D4AF37' }} />{item.qualityScore}
                    </span>
                  )}
                  {!item.isPastPerf && (
                    <form action={deleteSnippet.bind(null, item.id)}>
                      <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(192,194,198,0.3)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', marginBottom: 6, lineHeight: 1.4, fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.title}
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(192,194,198,0.55)',
                lineHeight: 1.55,
                marginBottom: 10,
                overflow: 'hidden',
                display: '-webkit-box' as any,
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as any,
              }}>
                {item.preview}
              </div>
              {item.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {item.tags.slice(0, 4).map((tag: string) => (
                    <span key={tag} style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: 'rgba(192,194,198,0.5)',
                      background: 'rgba(192,194,198,0.06)',
                      border: '1px solid rgba(192,194,198,0.1)',
                      padding: '2px 7px',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      <Tag size={7} strokeWidth={1.5} />{tag}
                    </span>
                  ))}
                </div>
              )}
            </GlassPanel>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '56px' }}>
          <Library size={36} strokeWidth={1} style={{ color: 'rgba(192,194,198,0.15)', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontSize: 14, color: '#C0C2C6', marginBottom: 4 }}>No content found</p>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.45)' }}>Add snippets above or add past performance records.</p>
        </div>
      )}
    </div>
  );
}
