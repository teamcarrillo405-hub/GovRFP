'use client'

import type { ComplianceAlert, AlertSeverity } from '@/lib/editor/compliance-alerts'

interface Props {
  alerts: ComplianceAlert[]
  onClose?: () => void
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: '#FF4D4F',
  warning:  '#F59E0B',
  info:     '#2F80FF',
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'CRITICAL',
  warning:  'WARNING',
  info:     'INFO',
}

function countBySeverity(alerts: ComplianceAlert[], severity: AlertSeverity): number {
  return alerts.filter(a => a.severity === severity).length
}

export function ComplianceAlertsPanel({ alerts, onClose }: Props) {
  const criticalCount = countBySeverity(alerts, 'critical')
  const warningCount  = countBySeverity(alerts, 'warning')

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(192,194,198,0.6)',
          }}>
            Compliance Alerts
          </span>
          {criticalCount > 0 && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "'Oxanium', sans-serif",
              letterSpacing: '0.06em',
              padding: '2px 7px',
              borderRadius: 9999,
              color: '#FF4D4F',
              background: 'rgba(255,77,79,0.12)',
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "'Oxanium', sans-serif",
              letterSpacing: '0.06em',
              padding: '2px 7px',
              borderRadius: 9999,
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.12)',
            }}>
              {warningCount} WARNING{warningCount !== 1 ? 'S' : ''}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(192,194,198,0.45)',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
            aria-label="Close alerts panel"
          >
            &times;
          </button>
        )}
      </div>

      {/* Empty state */}
      {alerts.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(0,196,140,0.08)',
          border: '1px solid rgba(0,196,140,0.2)',
        }}>
          <span style={{ fontSize: 14, color: '#00C48C' }}>&#10003;</span>
          <span style={{
            fontSize: 12,
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#00C48C',
          }}>
            All mandatory requirements addressed.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(11,11,13,0.4)',
              }}
            >
              {/* Severity bar */}
              <div style={{
                width: 3,
                borderRadius: 2,
                flexShrink: 0,
                alignSelf: 'stretch',
                background: SEVERITY_COLOR[alert.severity],
              }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "'Oxanium', sans-serif",
                    letterSpacing: '0.08em',
                    color: SEVERITY_COLOR[alert.severity],
                  }}>
                    {SEVERITY_LABEL[alert.severity]}
                  </span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: '#F5F5F7',
                  }}>
                    {alert.title}
                  </span>
                </div>

                <p style={{
                  fontSize: 11,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: 'rgba(192,194,198,0.6)',
                  margin: '4px 0 0 0',
                  lineHeight: 1.5,
                }}>
                  {alert.detail}
                </p>

                {alert.requirementId && (
                  <span style={{
                    display: 'inline-block',
                    marginTop: 5,
                    fontSize: 9,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: 'rgba(192,194,198,0.45)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(192,194,198,0.08)',
                    letterSpacing: '0.04em',
                  }}>
                    {alert.requirementId}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
