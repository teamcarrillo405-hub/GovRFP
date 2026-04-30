'use client'

import { useState } from 'react'

interface Props {
  accessToken: string
}

const SECTION_TYPES = [
  'Technical Approach',
  'Management Approach',
  'Past Performance',
  'Price / Cost Narrative',
  'Executive Summary',
  'Staffing Plan',
  'Quality Control Plan',
  'Safety Plan',
]

const S = {
  label: { fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', color: 'rgba(192,194,198,0.45)', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  select: {
    width: '100%',
    background: 'rgba(11,11,13,0.6)',
    border: '1px solid rgba(192,194,198,0.18)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 12,
    color: '#F5F5F7',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    background: 'rgba(11,11,13,0.6)',
    border: '1px solid rgba(192,194,198,0.18)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 11,
    color: '#F5F5F7',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
  },
  btn: (variant: 'red' | 'ghost'): React.CSSProperties => ({
    width: '100%',
    background: variant === 'red' ? '#FF1A1A' : 'rgba(192,194,198,0.08)',
    color: variant === 'red' ? '#fff' : '#C0C2C6',
    border: variant === 'red' ? 'none' : '1px solid rgba(192,194,198,0.15)',
    borderRadius: 8,
    padding: '9px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    marginBottom: 8,
  }),
  draft: {
    background: 'rgba(26,29,33,0.72)',
    border: '1px solid rgba(192,194,198,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    color: '#C0C2C6',
    lineHeight: 1.6,
    fontFamily: "'Inter', sans-serif",
    whiteSpace: 'pre-wrap' as const,
    marginBottom: 12,
    maxHeight: 320,
    overflowY: 'auto' as const,
  },
  err: { fontSize: 11, color: '#FF4D4F', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 },
  status: { fontSize: 10, color: 'rgba(192,194,198,0.35)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' as const, marginBottom: 8 },
}

async function insertIntoWord(text: string): Promise<void> {
  const Word = (window as any).Word
  if (!Word) {
    console.log('[GovTool] Insert (no Word context):', text.slice(0, 80))
    return
  }
  await Word.run(async (context: any) => {
    const range = context.document.getSelection()
    range.insertText(text, 'Replace')
    await context.sync()
  })
}

export function WriteTab({ accessToken }: Props) {
  const [sectionType, setSectionType] = useState(SECTION_TYPES[0])
  const [rfpContext, setRfpContext] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inserting, setInserting] = useState(false)
  const [insertDone, setInsertDone] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setDraft('')
    setInsertDone(false)
    try {
      const res = await fetch('/api/addin/generate-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sectionType, rfpContext }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setDraft(data.text ?? '')
    } catch (e: any) {
      setError(e.message ?? 'Generation failed')
    }
    setLoading(false)
  }

  async function handleInsert() {
    if (!draft) return
    setInserting(true)
    try {
      await insertIntoWord(draft)
      setInsertDone(true)
    } catch (e: any) {
      setError(e.message ?? 'Insert failed')
    }
    setInserting(false)
  }

  return (
    <div>
      <label style={S.label}>Section type</label>
      <select
        style={S.select}
        value={sectionType}
        onChange={e => setSectionType(e.target.value)}
      >
        {SECTION_TYPES.map(s => (
          <option key={s} value={s} style={{ background: '#1A1D21' }}>{s}</option>
        ))}
      </select>

      <label style={S.label}>RFP context (optional)</label>
      <textarea
        style={S.textarea}
        placeholder="Paste Section L/M criteria or key requirements..."
        value={rfpContext}
        onChange={e => setRfpContext(e.target.value)}
      />

      <button style={S.btn('red')} onClick={handleGenerate} disabled={loading}>
        {loading ? 'GENERATING...' : 'GENERATE DRAFT'}
      </button>

      {error && <div style={S.err}>{error}</div>}

      {draft && (
        <>
          <div style={S.draft}>{draft}</div>
          <button style={S.btn('red')} onClick={handleInsert} disabled={inserting}>
            {inserting ? 'INSERTING...' : 'INSERT AT CURSOR'}
          </button>
          <button style={S.btn('ghost')} onClick={handleGenerate} disabled={loading}>
            REGENERATE
          </button>
          {insertDone && <div style={S.status}>Inserted into document.</div>}
        </>
      )}
    </div>
  )
}
