'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  proposalId: string
}

export default function SaveSnapshotButton({ proposalId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Failed to save snapshot')
        return
      }
      setLabel('')
      setLabelOpen(false)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {labelOpen && (
        <input
          type="text"
          placeholder="Snapshot label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          autoFocus
          style={{
            fontSize: 13,
            padding: '5px 10px',
            border: '1px solid #2F80FF',
            borderRadius: 6,
            outline: 'none',
            width: 200,
            color: '#0F172A',
          }}
        />
      )}
      {error && (
        <span style={{ fontSize: 12, color: '#FF4D4F' }}>{error}</span>
      )}
      {!labelOpen ? (
        <button
          onClick={() => setLabelOpen(true)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: '#2F80FF',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          Save Snapshot
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: saving ? '#94A3B8' : '#2F80FF',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setLabelOpen(false); setLabel(''); setError(null) }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#64748B',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
