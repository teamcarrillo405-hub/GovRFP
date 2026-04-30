'use client'

import { useState } from 'react'

interface Props {
  proposalId: string
}

const BTN_STYLE: React.CSSProperties = {
  padding: '10px 22px',
  background: '#FF1A1A',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  letterSpacing: '0.08em',
  cursor: 'pointer',
  textTransform: 'uppercase',
}

const BTN_DISABLED_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  background: 'rgba(255,26,26,0.4)',
  cursor: 'not-allowed',
}

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 200,
  background: 'rgba(11,11,13,0.6)',
  border: '1px solid rgba(192,194,198,0.15)',
  borderRadius: 8,
  color: '#C0C2C6',
  fontSize: 13,
  lineHeight: 1.7,
  padding: '14px 16px',
  fontFamily: "'Space Grotesk', sans-serif",
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function CostNarrativeButton({ proposalId }: Props) {
  const [loading, setLoading] = useState(false)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/cost-narrative`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { narrative: string }
      setNarrative(data.narrative)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.55)', margin: 0, lineHeight: 1.6 }}>
        Generate a FAR 15.408-compliant cost narrative based on your labor categories and cost breakdown. The narrative is editable — copy or refine it before submitting.
      </p>

      <div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={loading ? BTN_DISABLED_STYLE : BTN_STYLE}
        >
          {loading ? 'GENERATING...' : 'GENERATE COST NARRATIVE'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#FF4D4F', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', borderRadius: 6, padding: '8px 12px' }}>
          Error: {error}
        </div>
      )}

      {narrative !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)' }}>
            Generated Narrative — edit before use
          </div>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            style={TEXTAREA_STYLE}
          />
        </div>
      )}
    </div>
  )
}
