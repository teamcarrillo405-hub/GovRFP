'use client'

import Link from 'next/link'
import type { WinFactors } from '@/lib/analysis/types'

interface PrWinAdvisorPanelProps {
  winScore: number | null
  winFactors: WinFactors
  analysisHref: string
}

function scoreColor(score: number): string {
  if (score >= 75) return '#00C48C'
  if (score >= 50) return '#F59E0B'
  return '#FF4D4F'
}

interface FactorRow {
  label: string
  weight: string
  score: number
}

export default function PrWinAdvisorPanel({ winScore, winFactors, analysisHref }: PrWinAdvisorPanelProps) {
  const score = winScore ?? 0

  // Verdict
  const isGo      = score >= 65
  const isConsider = score >= 45 && score < 65
  const verdictLabel  = isGo ? 'GO' : isConsider ? 'CONSIDER' : 'NO-BID'
  const verdictColor  = isGo ? '#00C48C' : isConsider ? '#F59E0B' : '#FF4D4F'

  // Factor rows
  const factors: FactorRow[] = [
    { label: 'Scope Alignment',     weight: '30%', score: winFactors.scope_alignment.score },
    { label: 'Certifications',      weight: '25%', score: winFactors.certifications_match },
    { label: 'Set-Aside Match',     weight: '20%', score: winFactors.set_aside_match },
    { label: 'Past Performance',    weight: '15%', score: winFactors.past_performance_relevance.score },
    { label: 'Competition Level',   weight: '10%', score: winFactors.competition_level.score },
  ]

  // Gaps — pull from scope_alignment and past_performance_relevance, cap at 3
  const rawGaps: string[] = [
    ...(winFactors.scope_alignment.gaps ?? []),
    ...(winFactors.past_performance_relevance.gaps ?? []),
  ]
  const gaps = rawGaps.slice(0, 3)

  // Recommendation: use the reasoning from whichever of the two detailed factors scores lower
  const scopeScore = winFactors.scope_alignment.score
  const ppScore    = winFactors.past_performance_relevance.score
  const reasoningText =
    scopeScore <= ppScore
      ? winFactors.scope_alignment.reasoning
      : winFactors.past_performance_relevance.reasoning

  return (
    <div style={{
      background: 'rgba(26,29,33,0.72)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(192,194,198,0.1)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'rgba(192,194,198,0.45)',
        }}>
          PrWin Analysis
        </span>
        <span style={{
          padding: '3px 10px',
          borderRadius: 9999,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: verdictColor,
          background: verdictColor + '18',
        }}>
          {verdictLabel}
        </span>
      </div>

      {/* ── Factor bars ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {factors.map((f) => {
          const barColor = scoreColor(f.score)
          return (
            <div key={f.label}>
              {/* Label row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: '#F5F5F7',
                  }}>
                    {f.label}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(192,194,198,0.45)',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                    {f.weight}
                  </span>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: barColor,
                }}>
                  {f.score}
                </span>
              </div>
              {/* Bar track */}
              <div style={{
                height: 4,
                borderRadius: 2,
                background: 'rgba(192,194,198,0.1)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, f.score))}%`,
                  borderRadius: 2,
                  background: barColor,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Gaps ── */}
      {gaps.length > 0 && (
        <div style={{
          background: 'rgba(255,77,79,0.06)',
          border: '1px solid rgba(255,77,79,0.15)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(255,77,79,0.8)',
            marginBottom: 2,
          }}>
            Key Gaps
          </div>
          {gaps.map((gap, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              fontSize: 11,
              color: 'rgba(192,194,198,0.7)',
              lineHeight: 1.4,
            }}>
              <span style={{
                flexShrink: 0,
                marginTop: 1,
                width: 14,
                height: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 9999,
                background: 'rgba(255,77,79,0.15)',
                color: '#FF4D4F',
                fontSize: 9,
                fontWeight: 700,
              }}>
                !
              </span>
              {gap}
            </div>
          ))}
        </div>
      )}

      {/* ── Recommendation ── */}
      {reasoningText && (
        <div style={{
          background: 'rgba(192,194,198,0.04)',
          border: '1px solid rgba(192,194,198,0.08)',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(192,194,198,0.45)',
            marginBottom: 6,
          }}>
            Recommendation
          </div>
          <p style={{
            margin: 0,
            fontSize: 11,
            color: 'rgba(192,194,198,0.7)',
            lineHeight: 1.5,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {reasoningText}
          </p>
        </div>
      )}

      {/* ── Bottom CTA row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 4,
        borderTop: '1px solid rgba(192,194,198,0.08)',
      }}>
        <Link
          href={analysisHref}
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#C0C2C6',
            border: '1px solid rgba(192,194,198,0.15)',
            borderRadius: 6,
            padding: '5px 12px',
            textDecoration: 'none',
          }}
        >
          View Full Analysis
        </Link>
        <Link
          href="/analysis"
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#2F80FF',
            border: '1px solid rgba(47,128,255,0.25)',
            borderRadius: 6,
            padding: '5px 12px',
            textDecoration: 'none',
          }}
        >
          Improve Score
        </Link>
      </div>

    </div>
  )
}
