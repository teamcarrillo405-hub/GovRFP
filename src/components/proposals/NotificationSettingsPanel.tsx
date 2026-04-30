'use client'

import { useEffect, useState } from 'react'

interface Props {
  proposalId: string
  proposalTitle: string
}

interface Settings {
  slack_webhook_url: string | null
  teams_webhook_url: string | null
  notify_task_assign: boolean
  notify_deadline: boolean
  notify_status: boolean
}

const DEFAULT_SETTINGS: Settings = {
  slack_webhook_url: null,
  teams_webhook_url: null,
  notify_task_assign: true,
  notify_deadline: true,
  notify_status: true,
}

export default function NotificationSettingsPanel({ proposalId }: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load existing settings on mount
  useEffect(() => {
    fetch(`/api/proposals/${proposalId}/notifications`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings({
            slack_webhook_url: data.settings.slack_webhook_url ?? null,
            teams_webhook_url: data.settings.teams_webhook_url ?? null,
            notify_task_assign: data.settings.notify_task_assign ?? true,
            notify_deadline: data.settings.notify_deadline ?? true,
            notify_status: data.settings.notify_status ?? true,
          })
        }
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setLoading(false))
  }, [proposalId])

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast('error', (err as { error?: string }).error ?? 'Failed to save settings')
      } else {
        showToast('success', 'Settings saved. Test notification sent.')
      }
    } catch {
      showToast('error', 'Network error — could not save settings')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(11,11,13,0.5)',
    border: '1px solid rgba(192,194,198,0.15)',
    borderRadius: 6,
    color: '#C0C2C6',
    fontSize: 12,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(192,194,198,0.6)',
    marginBottom: 4,
    display: 'block',
  }

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(192,194,198,0.06)',
  }

  if (loading) return null

  return (
    <div
      style={{
        background: 'rgba(26,29,33,0.72)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(192,194,198,0.1)',
        borderRadius: 12,
        padding: 20,
        position: 'relative',
      }}
    >
      {/* Section header */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'rgba(192,194,198,0.45)',
          marginBottom: 16,
        }}
      >
        Notification Settings
      </div>

      {/* Webhook URL inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Slack Webhook URL</label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={settings.slack_webhook_url ?? ''}
            onChange={(e) =>
              setSettings((s) => ({ ...s, slack_webhook_url: e.target.value || null }))
            }
            style={inputStyle}
            autoComplete="off"
          />
        </div>

        <div>
          <label style={labelStyle}>Microsoft Teams Webhook URL</label>
          <input
            type="url"
            placeholder="https://your-org.webhook.office.com/..."
            value={settings.teams_webhook_url ?? ''}
            onChange={(e) =>
              setSettings((s) => ({ ...s, teams_webhook_url: e.target.value || null }))
            }
            style={inputStyle}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Toggle rows */}
      <div style={{ marginBottom: 16 }}>
        {(
          [
            { key: 'notify_task_assign', label: 'Task assignments' },
            { key: 'notify_deadline', label: 'Deadline alerts (7 days out)' },
            { key: 'notify_status', label: 'Status changes' },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} style={toggleRowStyle}>
            <span style={{ fontSize: 12, color: '#C0C2C6' }}>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [key]: e.target.checked }))
              }
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#FF1A1A' }}
            />
          </div>
        ))}
      </div>

      {/* Save & Test button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saving ? 'rgba(255,26,26,0.5)' : '#FF1A1A',
          color: '#fff',
          fontFamily: "'Oxanium', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '10px 20px',
          border: 'none',
          borderRadius: 8,
          cursor: saving ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {saving ? 'Saving...' : 'Save & Test'}
      </button>

      {/* Toast */}
      {toast && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            background:
              toast.type === 'success'
                ? 'rgba(0,196,140,0.12)'
                : 'rgba(255,26,26,0.12)',
            color: toast.type === 'success' ? '#00C48C' : '#FF6B6B',
            border: `1px solid ${toast.type === 'success' ? 'rgba(0,196,140,0.25)' : 'rgba(255,26,26,0.25)'}`,
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
