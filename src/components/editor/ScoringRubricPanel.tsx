'use client'

import { useState } from 'react'
import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'
import type { ScoringFeedbackResult } from '@/app/api/proposals/[id]/scoring-feedback/route'

// Maps proposal topics to proposal section names for filtering
const TOPIC_TO_SECTIONS: Record<string, ComplianceMatrixRow['proposal_section'][]> = {
  'Technical': ['Executive Summary', 'Technical Approach'],
  'Certifications': ['Executive Summary'],
  'Management': ['Management Plan'],
  'Past Performance': ['Past Performance'],
  'Price': ['Price Narrative'],
  'Deliverables': ['Technical Approach'],
  'Other': ['Executive Summary', 'Technical Approach'],
}

interface Props {
  proposalId: string
  sectionName: string
  plainText: string
  requirements: AnalysisRequirement[]
  complianceMatrix: ComplianceMatrixRow[]
}

// ── Score gauge badge ─────────────────────────────────────────────────────────

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0

  let colorClass: string
  if (pct >= 70) {
    colorClass = 'bg-green-100 text-green-800 border-green-300'
  } else if (pct >= 50) {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-300'
  } else {
    colorClass = 'bg-red-100 text-red-800 border-red-300'
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center font-bold ${colorClass}`}
        aria-label={`Estimated score: ${score} out of ${max}`}
      >
        <span className="text-2xl leading-none">{score}</span>
        <span className="text-xs font-normal opacity-70">/ {max}</span>
      </div>
      <p className="text-xs text-gray-500">Estimated Score</p>
    </div>
  )
}

// ── Evaluation factor card ────────────────────────────────────────────────────

function FactorCard({
  row,
  requirements,
}: {
  row: ComplianceMatrixRow
  requirements: AnalysisRequirement[]
}) {
  const req = requirements.find((r) => r.id === row.requirement_id)
  const label = req ? req.proposal_topic : 'Evaluation Factor'
  const snippet = req
    ? req.text.length > 100
      ? req.text.slice(0, 100) + '...'
      : req.text
    : row.rationale.slice(0, 100)

  const statusColors: Record<ComplianceMatrixRow['coverage_status'], string> = {
    addressed: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unaddressed: 'bg-red-100 text-red-800',
  }
  const statusLabels: Record<ComplianceMatrixRow['coverage_status'], string> = {
    addressed: 'Addressed',
    partial: 'Partial',
    unaddressed: 'Unaddressed',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{snippet}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[row.coverage_status]}`}
        >
          {statusLabels[row.coverage_status]}
        </span>
      </div>
      <p className="text-xs text-gray-400 italic">Section: {row.proposal_section}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScoringRubricPanel({
  proposalId,
  sectionName,
  plainText,
  requirements,
  complianceMatrix,
}: Props) {
  const [loadingScore, setLoadingScore] = useState(false)
  const [scoreResult, setScoreResult] = useState<ScoringFeedbackResult | null>(null)
  const [scoreError, setScoreError] = useState<string | null>(null)

  // Filter compliance matrix rows that map to the current section
  const sectionRows = complianceMatrix.filter((row) => {
    // Direct match on proposal_section field
    if (row.proposal_section.toLowerCase().includes(sectionName.toLowerCase())) return true
    if (sectionName.toLowerCase().includes(row.proposal_section.toLowerCase())) return true

    // Match via topic mapping
    const req = requirements.find((r) => r.id === row.requirement_id)
    if (!req) return false
    const applicableSections = TOPIC_TO_SECTIONS[req.proposal_topic] ?? []
    return applicableSections.some(
      (s) =>
        s.toLowerCase().includes(sectionName.toLowerCase()) ||
        sectionName.toLowerCase().includes(s.toLowerCase()),
    )
  })

  // Requirements relevant to this section (for the API call)
  const relevantRequirements = requirements.filter((req) => {
    const applicableSections = TOPIC_TO_SECTIONS[req.proposal_topic] ?? []
    return applicableSections.some(
      (s) =>
        s.toLowerCase().includes(sectionName.toLowerCase()) ||
        sectionName.toLowerCase().includes(s.toLowerCase()),
    )
  })

  const hasContent = plainText.trim().length > 0

  const handleScoreSection = async () => {
    setLoadingScore(true)
    setScoreError(null)
    setScoreResult(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/scoring-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionName,
          plainText,
          requirements: relevantRequirements,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = (await res.json()) as ScoringFeedbackResult
      setScoreResult(data)
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'Evaluation failed')
    } finally {
      setLoadingScore(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Scoring Rubric</h2>
        <p className="text-sm text-gray-500 mt-1">
          Section M evaluation criteria for{' '}
          <span className="font-semibold text-gray-700">{sectionName}</span>
        </p>
      </div>

      {/* Evaluation factors from Section M */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Evaluation Factors
        </h3>

        {sectionRows.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-8 text-center">
            <p className="text-sm text-gray-500">
              No evaluation factors mapped to this section yet.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Factors are extracted from Section M of your RFP during analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sectionRows.map((row, i) => (
              <FactorCard key={`${row.requirement_id}-${i}`} row={row} requirements={requirements} />
            ))}
          </div>
        )}
      </section>

      {/* AI Scoring Feedback */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              AI SSEB Feedback
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Scored by claude-haiku-4-5 acting as an SSEB evaluator
            </p>
          </div>

          {hasContent && (
            <button
              onClick={handleScoreSection}
              disabled={loadingScore}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingScore ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Evaluating...
                </>
              ) : (
                'Score This Section'
              )}
            </button>
          )}
        </div>

        {/* Empty state — no content */}
        {!hasContent && !scoreResult && !scoreError && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Write content in this section to get scoring feedback.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loadingScore && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-10 text-center space-y-3">
            <svg
              className="animate-spin h-6 w-6 text-yellow-600 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-medium text-yellow-800">Evaluating as SSEB panel...</p>
            <p className="text-xs text-yellow-600">This takes a few seconds</p>
          </div>
        )}

        {/* Error state */}
        {scoreError && !loadingScore && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-6 space-y-3">
            <p className="text-sm font-semibold text-red-800">Evaluation failed</p>
            <p className="text-xs text-red-600">{scoreError}</p>
            <button
              onClick={handleScoreSection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-md hover:bg-red-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Result */}
        {scoreResult && !loadingScore && (
          <div className="space-y-6">
            {/* Score gauge */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center gap-4">
              <ScoreBadge score={scoreResult.estimatedScore} max={scoreResult.maxScore} />
            </div>

            {/* Strengths */}
            {scoreResult.strengths.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-green-800 mb-3">Strengths</h4>
                <ul className="space-y-1.5">
                  {scoreResult.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                      <span className="mt-0.5 text-green-500 shrink-0" aria-hidden="true">
                        +
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {scoreResult.weaknesses.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-red-800 mb-3">Weaknesses</h4>
                <ul className="space-y-1.5">
                  {scoreResult.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="mt-0.5 text-red-400 shrink-0" aria-hidden="true">
                        -
                      </span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {scoreResult.improvements.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-amber-800 mb-3">
                  Recommended Improvements
                </h4>
                <ol className="space-y-2">
                  {scoreResult.improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="shrink-0 font-semibold text-amber-500">{i + 1}.</span>
                      {imp}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Re-score button */}
            <div className="flex justify-end">
              <button
                onClick={handleScoreSection}
                className="text-xs text-gray-500 underline hover:text-gray-700 transition-colors"
              >
                Re-score section
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
