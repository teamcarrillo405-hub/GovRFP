import type { WinFactors, WinFactorDetail } from '@/lib/analysis/types'
import { WIN_SCORE_WEIGHTS } from '@/lib/analysis/types'

interface Props {
  winScore: number
  winFactors: WinFactors
}

const FACTOR_LABELS: Record<string, string> = {
  scope_alignment: 'Scope Alignment',
  certifications_match: 'Certifications Match',
  set_aside_match: 'Set-Aside Match',
  past_performance_relevance: 'Past Performance',
  competition_level: 'Competition Level',
}

const FACTOR_ORDER: (keyof WinFactors)[] = [
  'scope_alignment',
  'certifications_match',
  'set_aside_match',
  'past_performance_relevance',
  'competition_level',
]

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScore(factor: WinFactors[keyof WinFactors]): number {
  if (typeof factor === 'number') return factor
  if (!factor || typeof factor !== 'object') return 0
  return (factor as WinFactorDetail).score ?? 0
}

function getReasoning(factor: WinFactors[keyof WinFactors]): string | undefined {
  if (typeof factor === 'number' || !factor || typeof factor !== 'object') return undefined
  return (factor as WinFactorDetail).reasoning
}

export default function WinScoreCard({ winScore, winFactors }: Props) {
  const scoreTextColor =
    winScore >= 70 ? 'text-green-600' : winScore >= 40 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
      {/* Score display */}
      <div className="flex flex-col items-center justify-center min-w-[100px]">
        <span className={`text-5xl font-bold ${scoreTextColor}`}>{winScore}</span>
        <span className="text-sm text-gray-500 mt-1">Win Probability</span>
      </div>

      {/* Factor breakdown */}
      <div className="flex-1 space-y-4">
        {FACTOR_ORDER.map((key) => {
          const factor = winFactors?.[key]
          const score = getScore(factor)
          const reasoning = getReasoning(factor)
          const weight = Math.round(WIN_SCORE_WEIGHTS[key] * 100)

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {FACTOR_LABELS[key]}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-900">{score}/100</span>
                  <span className="text-xs text-gray-500">{weight}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${scoreColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              {reasoning && (
                <p className="text-xs text-gray-500 mt-1">{reasoning}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
