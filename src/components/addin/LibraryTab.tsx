'use client'

import { useState, useEffect } from 'react'

interface Props {
  accessToken: string
}

interface Snippet {
  id: string
  title: string
  body: string
  category: string
  tags: string[]
}

async function insertIntoWord(text: string): Promise<void> {
  const Word = (window as any).Word
  if (!Word) { console.log('[GovTool] Insert:', text.slice(0, 80)); return }
  await Word.run(async (context: any) => {
    const range = context.document.getSelection()
    range.insertText(text, 'Replace')
    await context.sync()
  })
}

const CATEGORIES = ['all', 'technical', 'management', 'past_performance', 'general']

const S = {
  catRow: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const },
  catBtn: (active: boolean): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.06em',
    textTransform: 'capitalize' as const,
    padding: '4px 10px',
    borderRadius: 5,
    border: active ? 'none' : '1px solid rgba(192,194,198,0.15)',
    background: active ? '#FF1A1A' : 'rgba(192,194,198,0.06)',
    color: active ? '#fff' : 'rgba(192,194,198,0.45)',
    cursor: 'pointer',
  }),
  searchInput: {
    width: '100%',
    background: 'rgba(11,11,13,0.6)',
    border: '1px solid rgba(192,194,198,0.18)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    color: '#F5F5F7',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 12,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  card: {
    background: 'rgba(26,29,33,0.72)',
    border: '1px solid rgba(192,194,198,0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 },
  cardBody: { fontSize: 11, color: 'rgba(192,194,198,0.6)', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 },
  btn: {
    marginTop: 8,
    background: '#FF1A1A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
  },
  empty: { fontSize: 11, color: 'rgba(192,194,198,0.3)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' as const, padding: '24px 0' },
  err: { fontSize: 11, color: '#FF4D4F', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 },
}

export function LibraryTab({ accessToken }: Props) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [insertedId, setInsertedId] = useState<string | null>(null)

  async function fetchSnippets(query: string, cat: string) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (cat !== 'all') params.set('category', cat)
      const res = await fetch(`/api/addin/snippets${params.toString() ? '?' + params : ''}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSnippets(data.snippets ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load snippets')
    }
    setLoading(false)
  }

  useEffect(() => { fetchSnippets('', 'all') }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchSnippets(q, category), 350)
    return () => clearTimeout(t)
  }, [q, category])

  async function handleInsert(snippet: Snippet) {
    await insertIntoWord(snippet.body)
    setInsertedId(snippet.id)
    setTimeout(() => setInsertedId(null), 2000)
  }

  return (
    <div>
      <div style={S.catRow}>
        {CATEGORIES.map(c => (
          <button key={c} style={S.catBtn(category === c)} onClick={() => setCategory(c)}>
            {c === 'all' ? 'All' : c.replace('_', ' ')}
          </button>
        ))}
      </div>
      <input
        style={S.searchInput}
        placeholder="Search snippets..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {error && <div style={S.err}>{error}</div>}
      {!loading && snippets.length === 0 && (
        <div style={S.empty}>No snippets found. Add some in the Library.</div>
      )}
      {snippets.map(s => (
        <div key={s.id} style={S.card}>
          <div style={S.cardTitle}>{s.title}</div>
          <div style={S.cardBody}>{s.body.slice(0, 180)}{s.body.length > 180 ? '...' : ''}</div>
          <button style={S.btn} onClick={() => handleInsert(s)}>
            {insertedId === s.id ? 'INSERTED' : 'INSERT'}
          </button>
        </div>
      ))}
    </div>
  )
}
