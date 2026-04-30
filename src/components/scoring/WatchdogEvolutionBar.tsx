interface Attempt {
  attempt: number
  score: number
  passed: boolean
  critique: string | null
}

interface Props {
  section: string
  attempts: Attempt[]
  threshold?: number
}

export function WatchdogEvolutionBar({ section, attempts, threshold = 75 }: Props) {
  if (attempts.length === 0) return null

  const sorted = [...attempts].sort((a, b) => a.attempt - b.attempt)
  const final = sorted[sorted.length - 1]
  const wasRedrafted = sorted.length > 1
  const passed = final.passed

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif",
          textTransform: 'uppercase', letterSpacing: '0.12em', color: '#C0C2C6',
        }}>
          {section}
        </span>
        <span style={{
          fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em',
          color: passed ? '#00C48C' : '#FF4D4F',
          background: passed ? 'rgba(0,196,140,0.1)' : 'rgba(255,77,79,0.1)',
          border: `1px solid ${passed ? 'rgba(0,196,140,0.3)' : 'rgba(255,77,79,0.3)'}`,
        }}>
          {passed ? 'APPROVED' : 'BEST EFFORT'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {sorted.map((a, i) => {
          const isLast = i === sorted.length - 1
          const color = a.score >= threshold ? '#00C48C' : a.score >= threshold * 0.85 ? '#F59E0B' : '#FF4D4F'
          const improved = i > 0 && a.score > sorted[i - 1].score

          return (
            <div key={a.attempt} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`,
                  background: isLast ? `${color}22` : 'rgba(11,11,13,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isLast ? `0 0 12px ${color}44` : 'none',
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color,
                  }}>
                    {a.score}
                  </span>
                </div>
                <span style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', letterSpacing: '0.06em' }}>
                  Draft {a.attempt}{improved ? ' \u2191' : ''}
                </span>
              </div>

              {!isLast && (
                <div style={{ flex: 1, height: 2, background: 'rgba(192,194,198,0.15)', margin: '0 8px', marginBottom: 16 }}>
                  <div style={{
                    height: '100%',
                    background: sorted[i + 1].score > a.score ? 'rgba(0,196,140,0.4)' : 'rgba(255,77,79,0.3)',
                    width: '100%',
                  }} />
                </div>
              )}
            </div>
          )
        })}

        {wasRedrafted && (
          <div style={{ marginLeft: 16, flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', letterSpacing: '0.06em' }}>
              Threshold: {threshold}
            </div>
          </div>
        )}
      </div>

      {!passed && final.critique && (
        <div style={{
          marginTop: 8, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,77,79,0.06)', border: '1px solid rgba(255,77,79,0.15)',
          fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.6)',
          lineHeight: 1.5,
        }}>
          {final.critique.slice(0, 200)}{final.critique.length > 200 ? '\u2026' : ''}
        </div>
      )}
    </div>
  )
}
