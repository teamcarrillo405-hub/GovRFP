'use client'

interface DeadlineCountdownProps {
  deadline: string | null
  now?: number
}

export function DeadlineCountdown({ deadline, now }: DeadlineCountdownProps) {
  if (!deadline) {
    return (
      <span style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace" }}>
        No deadline
      </span>
    )
  }

  const deadlineMs = new Date(deadline).getTime()
  const nowMs = now ?? Date.now()
  const daysRemaining = Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24))
  const isPast = daysRemaining <= 0

  const color = isPast || daysRemaining < 7
    ? '#FF4D4F'
    : daysRemaining <= 14
      ? '#F59E0B'
      : '#00C48C'

  const label = isPast ? 'Closed' : `${daysRemaining}d remaining`

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.04em',
        color,
        background: `${color}14`,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  )
}
