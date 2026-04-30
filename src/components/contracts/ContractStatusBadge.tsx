import type { ContractStatus } from '@/lib/contracts/types'

const BADGE: Record<ContractStatus, { label: string; color: string; bg: string }> = {
  active:      { label: 'Active',      color: '#00C48C', bg: 'rgba(0,196,140,0.1)' },
  expiring:    { label: 'Expiring',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  expired:     { label: 'Expired',     color: '#FF4D4F', bg: 'rgba(255,77,79,0.1)' },
  complete:    { label: 'Complete',    color: '#C0C2C6', bg: 'rgba(192,194,198,0.1)' },
  terminated:  { label: 'Terminated', color: '#FF4D4F', bg: 'rgba(255,77,79,0.08)' },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const b = BADGE[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: b.color, background: b.bg,
      border: `1px solid ${b.color}44`,
      padding: '2px 8px', borderRadius: 4,
    }}>
      {b.label}
    </span>
  )
}
