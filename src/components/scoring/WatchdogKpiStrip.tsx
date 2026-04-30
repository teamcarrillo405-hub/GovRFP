interface Props {
  scores: Array<{
    section_name: string
    attempt: number
    score: number
    passed: boolean
  }>
}

export function WatchdogKpiStrip({ scores }: Props) {
  if (scores.length === 0) return null

  const bySection = new Map<string, typeof scores>()
  for (const s of scores) {
    const arr = bySection.get(s.section_name) ?? []
    arr.push(s)
    bySection.set(s.section_name, arr)
  }

  const finals = Array.from(bySection.values()).map(arr =>
    arr.sort((a, b) => b.attempt - a.attempt)[0]
  )

  const avgScore = finals.length
    ? Math.round(finals.reduce((sum, f) => sum + f.score, 0) / finals.length)
    : 0
  const passCount = finals.filter(f => f.passed).length
  const passRate = finals.length ? Math.round((passCount / finals.length) * 100) : 0
  const redrafted = Array.from(bySection.values()).filter(arr => arr.length > 1).length

  const stats = [
    { label: 'Avg Quality Score', value: `${avgScore}/100`, color: avgScore >= 75 ? '#00C48C' : avgScore >= 60 ? '#F59E0B' : '#FF4D4F' },
    { label: 'Sections Redrafted', value: String(redrafted), color: redrafted > 0 ? '#D4AF37' : '#C0C2C6' },
    { label: 'Pass Rate', value: `${passRate}%`, color: passRate === 100 ? '#00C48C' : passRate >= 75 ? '#F59E0B' : '#FF4D4F' },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
      background: 'rgba(192,194,198,0.08)', borderRadius: 10, overflow: 'hidden',
      border: '1px solid rgba(192,194,198,0.1)', marginBottom: 20,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '14px 18px',
          background: 'rgba(26,29,33,0.72)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            fontSize: 8, fontWeight: 700, fontFamily: "'Oxanium', sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 6,
          }}>
            Quality Watchdog \u00b7 {s.label}
          </div>
          <div style={{
            fontSize: 26, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
            color: s.color, lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}
