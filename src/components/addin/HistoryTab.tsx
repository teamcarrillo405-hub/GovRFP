'use client'

import { useState, useEffect } from 'react'

interface Props {
  accessToken: string
}

interface PPRecord {
  id: string
  contract_title: string
  customer_name: string
  scope_narrative: string
  contract_value_usd: number | null
  naics_codes: string[]
  period_start: string | null
  period_end: string | null
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

function fmtValue(v: number | null) {
  if (!v) return ''
  return '$' + v.toLocaleString()
}

const S = {
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
    cursor: 'pointer',
  },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#F5F5F7', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 },
  cardMeta: { fontSize: 10, color: 'rgba(192,194,198,0.4)', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 },
  cardDesc: { fontSize: 11, color: 'rgba(192,194,198,0.6)', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 },
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

export function HistoryTab({ accessToken }: Props) {
  const [q, setQ] = useState('')
  const [records, setRecords] = useState<PPRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [insertedId, setInsertedId] = useState<string | null>(null)

  async function fetchRecords(query: string) {
    setLoading(true)
    setError('')
    try {
      const url = `/api/addin/past-performance${query ? `?q=${encodeURIComponent(query)}` : ''}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load records')
    }
    setLoading(false)
  }

  useEffect(() => { fetchRecords('') }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchRecords(q), 350)
    return () => clearTimeout(t)
  }, [q])

  async function handleInsert(record: PPRecord) {
    const text = `${record.contract_title} — ${record.customer_name}\n${record.scope_narrative}`
    await insertIntoWord(text)
    setInsertedId(record.id)
    setTimeout(() => setInsertedId(null), 2000)
  }

  return (
    <div>
      <input
        style={S.searchInput}
        placeholder="Search past performance..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {error && <div style={S.err}>{error}</div>}
      {!loading && records.length === 0 && (
        <div style={S.empty}>No records found.</div>
      )}
      {records.map(r => (
        <div key={r.id} style={S.card}>
          <div style={S.cardTitle}>{r.contract_title}</div>
          <div style={S.cardMeta}>{[r.customer_name, r.naics_codes?.[0], fmtValue(r.contract_value_usd)].filter(Boolean).join(' · ')}</div>
          <div style={S.cardDesc}>{r.scope_narrative?.slice(0, 160)}{(r.scope_narrative?.length ?? 0) > 160 ? '...' : ''}</div>
          <button style={S.btn} onClick={() => handleInsert(r)}>
            {insertedId === r.id ? 'INSERTED' : 'INSERT'}
          </button>
        </div>
      ))}
    </div>
  )
}
