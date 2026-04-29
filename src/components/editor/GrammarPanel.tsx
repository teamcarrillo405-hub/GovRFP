'use client'

import { useEffect, useRef, useState } from 'react'
import { analyzeGrammar, type GrammarIssue, type GrammarReport } from '@/lib/editor/grammar-analyzer'

interface Props {
  plainText: string
  sectionName: string
  onShowInDocument?: (issues: GrammarIssue[]) => void
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-700'
  if (score >= 60) return 'text-yellow-700'
  return 'text-red-700'
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Needs Work'
  return 'Poor'
}

// ---------------------------------------------------------------------------
// Issue type metadata
// ---------------------------------------------------------------------------

type IssueType = GrammarIssue['type']

const TYPE_LABEL: Record<IssueType, string> = {
  'passive-voice': 'Passive Voice',
  'weak-word': 'Weak Word',
  'jargon': 'Jargon',
  'long-sentence': 'Long Sentence',
  'repeated-word': 'Repeated Word',
  'grammar': 'Grammar',
}

const TYPE_BADGE_CLASS: Record<IssueType, string> = {
  'passive-voice': 'bg-orange-100 text-orange-800',
  'weak-word': 'bg-blue-100 text-blue-800',
  'jargon': 'bg-purple-100 text-purple-800',
  'long-sentence': 'bg-yellow-100 text-yellow-800',
  'repeated-word': 'bg-gray-100 text-gray-700',
  'grammar': 'bg-red-100 text-red-800',
}

const SEVERITY_BORDER: Record<GrammarIssue['severity'], string> = {
  error: 'border-l-4 border-red-500',
  warning: 'border-l-4 border-yellow-400',
  suggestion: 'border-l-4 border-gray-300',
}

const SEVERITY_ICON: Record<GrammarIssue['severity'], string> = {
  error: '●',
  warning: '▲',
  suggestion: '◆',
}

const SEVERITY_ICON_COLOR: Record<GrammarIssue['severity'], string> = {
  error: 'text-red-500',
  warning: 'text-yellow-500',
  suggestion: 'text-gray-400',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IssueCard({ issue }: { issue: GrammarIssue }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${SEVERITY_BORDER[issue.severity]}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 text-sm font-bold ${SEVERITY_ICON_COLOR[issue.severity]}`}>
          {SEVERITY_ICON[issue.severity]}
        </span>
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE_CLASS[issue.type]}`}
            >
              {TYPE_LABEL[issue.type]}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              &ldquo;{issue.text}&rdquo;
            </span>
          </div>

          {/* Suggestion */}
          <p className="text-sm text-gray-600 mb-2">{issue.suggestion}</p>

          {/* Sentence context */}
          {issue.sentenceContext && (
            <blockquote className="border-l-2 border-gray-200 pl-3 text-xs text-gray-500 italic leading-relaxed line-clamp-2">
              {issue.sentenceContext}
            </blockquote>
          )}
        </div>
      </div>
    </div>
  )
}

function SeveritySection({
  label,
  icon,
  iconColor,
  issues,
}: {
  label: string
  icon: string
  iconColor: string
  issues: GrammarIssue[]
}) {
  if (issues.length === 0) return null
  return (
    <div className="mb-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
        <span className={iconColor}>{icon}</span>
        {label}
        <span className="ml-auto text-xs font-normal text-gray-400">{issues.length}</span>
      </h3>
      <div className="flex flex-col gap-3">
        {issues.map((issue, idx) => (
          <IssueCard key={`${issue.type}-${idx}`} issue={issue} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GrammarPanel({ plainText, sectionName, onShowInDocument }: Props) {
  const [report, setReport] = useState<GrammarReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef(false)

  const runAnalysis = (text: string) => {
    setIsAnalyzing(true)
    // Defer to next tick so the loading state renders first
    setTimeout(() => {
      const result = analyzeGrammar(text)
      setReport(result)
      setIsAnalyzing(false)
    }, 0)
  }

  // Auto-analyze on mount and when plainText changes (debounced)
  useEffect(() => {
    if (manualRef.current) {
      manualRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runAnalysis(plainText)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [plainText])

  const handleReanalyze = () => {
    manualRef.current = true
    runAnalysis(plainText)
  }

  // ---------------------------------------------------------------------------
  // Empty / no-text states
  // ---------------------------------------------------------------------------

  const hasText = plainText.trim().length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Grammar &amp; Style Analysis
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">&ldquo;{sectionName}&rdquo;</p>
        </div>
        <div className="flex items-center gap-2">
          {onShowInDocument && report && report.issues.length > 0 && (
            <button
              onClick={() => onShowInDocument(report.issues)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 transition-colors"
            >
              Show in Document
            </button>
          )}
          <button
          onClick={handleReanalyze}
          disabled={isAnalyzing || !hasText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {isAnalyzing ? (
            <>
              <svg
                className="h-3.5 w-3.5 animate-spin text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Analyzing…
            </>
          ) : (
            'Re-analyze'
          )}
        </button>
        </div>
      </div>

      {/* ── No-text state ── */}
      {!hasText && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
          <p className="text-sm text-gray-500">
            Generate or write content in this section first.
          </p>
        </div>
      )}

      {/* ── Analyzing skeleton ── */}
      {hasText && isAnalyzing && !report && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">Analyzing…</p>
        </div>
      )}

      {/* ── Report ── */}
      {hasText && report && !isAnalyzing && (
        <>
          {/* Score card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6 shadow-sm">
            {/* Score row */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-3xl font-extrabold ${scoreColor(report.score)}`}>
                    {report.score}
                  </span>
                  <span className="text-lg text-gray-400 font-medium">/100</span>
                  <span className={`text-sm font-semibold ${scoreColor(report.score)}`}>
                    {scoreLabel(report.score)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(report.score)}`}
                    style={{ width: `${report.score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>
                <span className="font-semibold text-gray-800">{report.wordCount}</span> words
              </span>
              <span className="text-gray-300">·</span>
              <span>
                Avg sentence:{' '}
                <span className="font-semibold text-gray-800">{report.avgSentenceWords}</span> words
              </span>
              <span className="text-gray-300">·</span>
              <span>{report.readabilityLabel}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Passive voice:{' '}
              <span
                className={`font-semibold ${
                  report.passiveVoicePercent > 20 ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                {report.passiveVoicePercent}%
              </span>
            </div>
          </div>

          {/* ── Summary counts ── */}
          {report.issues.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-6">
              {(['error', 'warning', 'suggestion'] as const).map((sev) => {
                const count = report.issues.filter((i) => i.severity === sev).length
                if (count === 0) return null
                return (
                  <div key={sev} className="flex items-center gap-1.5 text-sm">
                    <span className={SEVERITY_ICON_COLOR[sev]}>{SEVERITY_ICON[sev]}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                    <span className="text-gray-500 capitalize">{sev === 'suggestion' ? 'Suggestions' : sev === 'warning' ? 'Warnings' : 'Errors'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Issue groups ── */}
          {report.issues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-green-200 bg-green-50 py-12 text-center">
              <p className="text-sm font-medium text-green-700">
                No issues found — this section reads well.
              </p>
            </div>
          ) : (
            <div>
              <SeveritySection
                label="Errors"
                icon={SEVERITY_ICON.error}
                iconColor={SEVERITY_ICON_COLOR.error}
                issues={report.issues.filter((i) => i.severity === 'error')}
              />
              <SeveritySection
                label="Warnings"
                icon={SEVERITY_ICON.warning}
                iconColor={SEVERITY_ICON_COLOR.warning}
                issues={report.issues.filter((i) => i.severity === 'warning')}
              />
              <SeveritySection
                label="Suggestions"
                icon={SEVERITY_ICON.suggestion}
                iconColor={SEVERITY_ICON_COLOR.suggestion}
                issues={report.issues.filter((i) => i.severity === 'suggestion')}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
