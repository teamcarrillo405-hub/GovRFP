'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { RedTeamCriterionScore, RedTeamResult } from '@/app/api/proposals/[id]/red-team/route'

// ─── Score helpers ─────────────────────────────────────────────────────────────

function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase()
  if (v === 'outstanding') return 'bg-green-600 text-white'
  if (v === 'good') return 'bg-green-400 text-white'
  if (v === 'acceptable') return 'bg-yellow-400 text-black'
  if (v === 'marginal') return 'bg-orange-500 text-white'
  return 'bg-red-600 text-white'
}

function scoreBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500'
  if (score >= 75) return 'bg-green-400'
  if (score >= 55) return 'bg-yellow-400'
  if (score >= 35) return 'bg-orange-500'
  return 'bg-red-500'
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${scoreBarColor(score)}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

// ─── Criterion Card ───────────────────────────────────────────────────────────

function CriterionCard({ c }: { c: RedTeamCriterionScore }) {
  const [editsOpen, setEditsOpen] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{c.criterion}</h3>
          <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {c.weight_display}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xl font-black text-[#ff7b20]">{c.score}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${verdictColor(c.verdict)}`}>
            {c.verdict}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 py-3 border-b border-gray-50">
        <ScoreBar score={c.score} />
      </div>

      {/* Bullets */}
      <div className="px-5 py-4 space-y-4">

        {c.strengths.length > 0 && (
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1.5">Strengths</p>
            <ul className="space-y-1">
              {c.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-green-500 shrink-0 mt-0.5">&#10003;</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.weaknesses.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1.5">Weaknesses</p>
            <ul className="space-y-1">
              {c.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-red-500 shrink-0 mt-0.5">&#8722;</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.risks.length > 0 && (
          <div>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1.5">Risks</p>
            <ul className="space-y-1">
              {c.risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-orange-500 shrink-0 mt-0.5">&#9650;</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.recommended_edits.length > 0 && (
          <div>
            <button
              onClick={() => setEditsOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span
                className={`inline-block transition-transform duration-200 ${editsOpen ? 'rotate-90' : ''}`}
              >
                &#9654;
              </span>
              Recommended Edits ({c.recommended_edits.length})
            </button>
            {editsOpen && (
              <ul className="mt-2 space-y-1.5 pl-4 border-l-2 border-gray-200">
                {c.recommended_edits.map((e, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {i + 1}. {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RedTeamPage() {
  const params = useParams<{ id: string }>()
  const proposalId = params.id

  const [result, setResult] = useState<RedTeamResult | null>(null)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [proposalTitle, setProposalTitle] = useState('Proposal')
  const [streamingChunks, setStreamingChunks] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // Load existing results on mount
  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/red-team/latest`)
        if (res.ok) {
          const data = await res.json()
          if (data.result) {
            setResult(data.result)
            setLastRunAt(data.created_at)
            setProposalTitle(data.proposal_title ?? 'Proposal')
          } else {
            setProposalTitle(data.proposal_title ?? 'Proposal')
          }
        }
      } catch {
        // ignore — first run
      }
    }
    loadExisting()
  }, [proposalId])

  async function runRedTeam() {
    setLoading(true)
    setError(null)
    setStatusMsg('Convening evaluation panel...')
    setStreamingChunks(0)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/proposals/${proposalId}/red-team`, {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = text
        try { msg = JSON.parse(text).error ?? text } catch { /* */ }
        throw new Error(msg)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue

          try {
            const event = JSON.parse(payload)

            if (event.type === 'red_team_start') {
              setStatusMsg(`Evaluating ${event.criteria_count} Section M criteria...`)
            } else if (event.type === 'red_team_chunk') {
              setStreamingChunks((n) => n + 1)
              setStatusMsg('Evaluation in progress...')
            } else if (event.type === 'red_team_complete') {
              setResult(event.result as RedTeamResult)
              setLastRunAt(event.created_at as string)
              setStatusMsg('')
            } else if (event.type === 'red_team_error') {
              setError(event.message as string)
              setStatusMsg('')
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const overallVerdict = result?.overall_verdict ?? ''
  const verdictLabel: Record<string, string> = {
    outstanding: 'Outstanding',
    good: 'Good',
    acceptable: 'Acceptable',
    marginal: 'Marginal',
    unacceptable: 'Unacceptable',
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href={`/proposals/${proposalId}`} className="hover:text-gray-700 max-w-[160px] truncate">{proposalTitle}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Red Team</span>
      </nav>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-gray-900 uppercase tracking-tight">
              Red Team Evaluation
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff7b20] text-white uppercase tracking-wide">
              {/* Target icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
              AI Evaluator
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Claude simulates a federal Source Selection Evaluation Board — scoring your proposal exactly as government evaluators would.
          </p>
        </div>
        {result && !loading && (
          <button
            onClick={runRedTeam}
            className="shrink-0 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Re-run
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 shrink-0 mt-0.5">&#9888;</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Evaluation failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">Dismiss</button>
        </div>
      )}

      {/* ── Loading / streaming state ── */}
      {loading && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg className="animate-spin h-5 w-5 text-[#ff7b20]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm font-semibold text-[#ff7b20]">
              {statusMsg || 'Evaluation in progress...'}
            </span>
          </div>
          {streamingChunks > 0 && (
            <p className="text-xs text-orange-600">
              Receiving evaluation... ({streamingChunks} tokens streamed)
            </p>
          )}
        </div>
      )}

      {/* ── No results CTA ── */}
      {!result && !loading && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          {/* Target icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ff7b20]/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff7b20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Run Your Red Team</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Claude will take on the role of a federal Source Selection Evaluation Board (SSEB) and score each drafted proposal section using the RFP&apos;s actual Section M evaluation criteria — exactly how the government would evaluate your proposal.
          </p>
          <ul className="text-xs text-gray-500 mb-8 space-y-1.5 text-left max-w-xs mx-auto">
            <li className="flex gap-2">&#10003; Criterion-by-criterion scoring (0–100)</li>
            <li className="flex gap-2">&#10003; Outstanding / Good / Acceptable / Marginal / Unacceptable verdicts</li>
            <li className="flex gap-2">&#10003; Strengths, Weaknesses, and Risks per criterion</li>
            <li className="flex gap-2">&#10003; Specific recommended edits to strengthen each section</li>
          </ul>
          <button
            onClick={runRedTeam}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#FDFF66] text-black text-sm font-black uppercase tracking-wide rounded-lg hover:brightness-105 transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
            Run Red Team
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="space-y-6">

          {/* Last run banner */}
          {lastRunAt && (
            <p className="text-xs text-gray-500">
              Last evaluated {new Date(lastRunAt).toLocaleString()}
            </p>
          )}

          {/* Overall score hero */}
          <div className={[
            'rounded-xl border-l-4 p-6 flex items-center gap-6',
            overallVerdict === 'outstanding' || overallVerdict === 'good'
              ? 'border-l-green-500 border border-green-100 bg-green-50'
              : overallVerdict === 'acceptable'
              ? 'border-l-yellow-400 border border-yellow-100 bg-yellow-50'
              : 'border-l-red-500 border border-red-100 bg-red-50',
          ].join(' ')}>
            <span className="text-6xl font-black text-[#ff7b20] leading-none shrink-0">
              {result.overall_score}
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Overall Score</span>
              <span className={[
                'text-lg font-black uppercase tracking-tight',
                overallVerdict === 'outstanding' || overallVerdict === 'good' ? 'text-green-700' : '',
                overallVerdict === 'acceptable' ? 'text-yellow-700' : '',
                overallVerdict === 'marginal' || overallVerdict === 'unacceptable' ? 'text-red-700' : '',
              ].join(' ')}>
                {verdictLabel[overallVerdict] ?? overallVerdict}
              </span>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                {result.summary}
              </p>
            </div>
            <span className={`ml-auto shrink-0 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide ${verdictColor(overallVerdict)}`}>
              {verdictLabel[overallVerdict] ?? overallVerdict}
            </span>
          </div>

          {/* Criteria cards */}
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Criterion Breakdown ({result.criteria_scores.length} criteria)
            </h2>
            <div className="space-y-4">
              {result.criteria_scores.map((c, i) => (
                <CriterionCard key={i} c={c} />
              ))}
            </div>
          </div>

          {/* Re-run CTA at bottom */}
          <div className="flex justify-center pt-4">
            <button
              onClick={runRedTeam}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FDFF66] text-black text-sm font-black uppercase tracking-wide rounded-lg hover:brightness-105 transition-all shadow-sm"
            >
              Re-run Red Team
            </button>
          </div>

        </div>
      )}

    </main>
  )
}
