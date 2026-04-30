'use client'

import { useState } from 'react'

interface Props {
  accessToken: string
}

interface ComplianceResult {
  score: number
  verdict: 'Go' | 'Caution' | 'No-Go'
  strengths: string[]
  gaps: string[]
  recommendation: string
}

const verdictColor = (v: string) =>
  v === 'Go' ? '#00C48C' : v === 'Caution' ? '#F59E0B' : '#FF4D4F'

const S = {
  label: { fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', color: 'rgba(192,194,198,0.45)', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
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
    minHeight: 100,
  },
  btn: {
    width: '100%',
    background: '#FF1A1A',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    marginBottom: 14,
  },
  btnGhost: {
    width: '100%',
    background: 'rgba(192,194,198,0.08)',
    color: '#C0C2C6',
    border: '1px solid rgba(192,194,198,0.15)',
    borderRadius: 8,
    padding: '9px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    marginBottom: 14,
  },
  panel: {
    background: 'rgba(26,29,33,0.72)',
    border: '1px solid rgba(192,194,198,0.1)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  err: { fontSize: 11, color: '#FF4D4F', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 },
  listItem: { fontSize: 11, color: 'rgba(192,194,198,0.7)', fontFamily: "'Inter', sans-serif", lineHeight: 1.5, marginBottom: 3 },
}

async function getWordSelection(): Promise<string> {
  const Word = (window as any).Word
  if (!Word) return ''
  return new Promise((resolve) => {
    Word.run(async (context: any) => {
      const range = context.document.getSelection()
      range.load('text')
      await context.sync()
      resolve(range.text ?? '')
    })
  })
}

export function ComplianceTab({ accessToken }: Props) {
  const [text, setText] = useState('')
  const [criteria, setCriteria] = useState('')
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState('')

  async function handlePullSelection() {
    setPulling(true)
    try {
      const selected = await getWordSelection()
      if (selected.trim()) setText(selected)
    } catch (e: any) {
      setError(e.message ?? 'Failed to read selection')
    }
    setPulling(false)
  }

  async function handleCheck() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/addin/check-compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text, criteria }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data as ComplianceResult)
    } catch (e: any) {
      setError(e.message ?? 'Check failed')
    }
    setLoading(false)
  }

  const vc = result ? verdictColor(result.verdict) : '#C0C2C6'

  return (
    <div>
      <button style={S.btnGhost} onClick={handlePullSelection} disabled={pulling}>
        {pulling ? 'READING...' : 'PULL FROM SELECTION'}
      </button>

      <label style={S.label}>Text to evaluate</label>
      <textarea
        style={S.textarea}
        placeholder="Paste or pull selected text from your document..."
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <label style={S.label}>Evaluation criteria (optional)</label>
      <textarea
        style={{ ...S.textarea, minHeight: 60 }}
        placeholder="Paste Section M criteria or evaluation factors..."
        value={criteria}
        onChange={e => setCriteria(e.target.value)}
      />

      <button style={S.btn} onClick={handleCheck} disabled={loading || !text.trim()}>
        {loading ? 'EVALUATING...' : 'CHECK COMPLIANCE'}
      </button>

      {error && <div style={S.err}>{error}</div>}

      {result && (
        <div style={S.panel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Oxanium', sans-serif", color: vc, lineHeight: 1 }}>
              {result.score}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', color: vc, background: `${vc}18`, padding: '4px 10px', borderRadius: 5 }}>
              {result.verdict.toUpperCase()}
            </span>
          </div>

          {result.strengths.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.12em', color: '#00C48C', marginBottom: 4, textTransform: 'uppercase' as const }}>Strengths</div>
              {result.strengths.map((s, i) => (
                <div key={i} style={S.listItem}>+ {s}</div>
              ))}
            </>
          )}

          {result.gaps.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.12em', color: '#FF4D4F', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' as const }}>Gaps</div>
              {result.gaps.map((g, i) => (
                <div key={i} style={S.listItem}>- {g}</div>
              ))}
            </>
          )}

          {result.recommendation && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,26,26,0.06)', borderRadius: 6, fontSize: 11, color: '#C0C2C6', fontFamily: "'Inter', sans-serif", lineHeight: 1.5, borderLeft: '2px solid #FF1A1A' }}>
              {result.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
