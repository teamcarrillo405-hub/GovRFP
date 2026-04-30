'use client'
import { useState, useTransition } from 'react'
import type { ContractDeliverable } from '@/lib/contracts/types'

interface Props {
  deliverable: ContractDeliverable
  onUpdate: (id: string, status: ContractDeliverable['status']) => Promise<void>
}

const STATUS_OPTIONS: ContractDeliverable['status'][] = ['pending', 'submitted', 'accepted', 'overdue']
const STATUS_COLOR: Record<ContractDeliverable['status'], string> = {
  pending:   '#C0C2C6',
  submitted: '#2F80FF',
  accepted:  '#00C48C',
  overdue:   '#FF4D4F',
}

export function DeliverableRow({ deliverable, onUpdate }: Props) {
  const [status, setStatus] = useState(deliverable.status)
  const [pending, startTransition] = useTransition()

  const handleChange = (next: ContractDeliverable['status']) => {
    setStatus(next)
    startTransition(() => onUpdate(deliverable.id, next))
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
      borderBottom: '1px solid rgba(192,194,198,0.06)',
      opacity: pending ? 0.6 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F5F7' }}>{deliverable.title}</div>
        {deliverable.due_date && (
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', marginTop: 2 }}>
            Due: {deliverable.due_date}{deliverable.frequency && deliverable.frequency !== 'oneshot' ? ` \u00b7 ${deliverable.frequency}` : ''}
          </div>
        )}
      </div>
      <select
        value={status}
        onChange={e => handleChange(e.target.value as ContractDeliverable['status'])}
        style={{
          fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
          color: STATUS_COLOR[status], background: 'rgba(11,11,13,0.6)',
          border: `1px solid ${STATUS_COLOR[status]}44`,
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.06em',
        }}
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s} value={s} style={{ background: '#1A1D21', color: '#F5F5F7' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
