'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RankedPp {
  id: string
  contract_title: string
  customer_name: string
  naics_codes: string[]
  set_asides_claimed: string[]
  contract_value_usd: string | number | null
  cpars_rating: string | null
  score: number
  breakdown: { naics: number; setAside: number; value: number; keyword: number }
}

interface Props {
  proposalId: string
  /**
   * Called once the stream finishes with the complete Markdown narrative.
   * Parent converts to HTML and inserts at the end of the active section.
   */
  onInsertNarrative: (fullMarkdown: string) => void
}

/**
 * Editor sidebar that loads the user's Past Performance records ranked by
 * relevance to the current proposal's RFP analysis.
 *
 * Click a card → POST /api/past-performance/tailor (streams Claude-drafted
 * Markdown narrative) → onInsertNarrative chunks fed into the active section.
 *
 * Uses the relevance ranker server-side; the panel just renders + dispatches.
 */
export function PastPerformancePanel({ proposalId, onInsertNarrative }: Props) {
  const [ranked, setRanked] = useState<RankedPp[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tailoringId, setTailoringId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetch(`/api/past-performance/ranked?proposalId=${proposalId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) setError(data.error)
        else setRanked(data.ranked ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load ranked records')
      })
    return () => {
      cancelled = true
    }
  }, [proposalId])

  const tailorAndInsert = async (ppId: string) => {
    setTailoringId(ppId)
    setError(null)
    try {
      const res = await fetch('/api/past-performance/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, ppId }),
      })
      if (!res.ok) {
        setError(`Tailor failed: ${res.status} ${await res.text()}`)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setError('No response body')
        return
      }
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
      }
      if (full.trim()) onInsertNarrative(full)
      else setError('Narrative was empty — try again')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tailor stream failed')
    } finally {
      setTailoringId(null)
    }
  }

  if (error) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
        {error}
      </div>
    )
  }

  if (ranked === null) {
    return <div className="text-sm text-gray-500">Loading ranked Past Performance…</div>
  }

  if (ranked.length === 0) {
    return (
      <div className="rounded-md border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-700 mb-2">No Past Performance records yet.</p>
        <Link
          href="/past-performance/new"
          className="text-xs font-semibold text-yellow-800 underline"
        >
          Add your first record →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Past Performance (top {ranked.length})
        </h3>
        <Link
          href="/past-performance"
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Library
        </Link>
      </div>

      {ranked.map((r) => {
        const busy = tailoringId === r.id
        return (
          <div
            key={r.id}
            className="rounded-md border border-gray-200 bg-white p-3 hover:border-gray-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.contract_title}
                </p>
                <p className="text-xs text-gray-500 truncate">{r.customer_name}</p>
              </div>
              <ScorePill score={r.score} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              {(r.naics_codes ?? []).slice(0, 2).map((n) => (
                <span key={n} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {n}
                </span>
              ))}
              {(r.set_asides_claimed ?? []).slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-900 border border-yellow-200"
                >
                  {s}
                </span>
              ))}
              {r.contract_value_usd != null && (
                <span className="text-gray-500 font-mono">
                  ${Number(r.contract_value_usd).toLocaleString()}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div
                className="text-[10px] text-gray-500 font-mono"
                title={`naics ${r.breakdown.naics} · set-aside ${r.breakdown.setAside} · value ${r.breakdown.value} · keyword ${r.breakdown.keyword}`}
              >
                N {r.breakdown.naics} · SA {r.breakdown.setAside} · V {r.breakdown.value} · K{' '}
                {r.breakdown.keyword}
              </div>
              <button
                type="button"
                onClick={() => tailorAndInsert(r.id)}
                disabled={busy || tailoringId !== null}
                className="px-2.5 py-1 text-xs font-semibold rounded text-gray-900 disabled:opacity-50"
                style={{ backgroundColor: '#F5C518' }}
              >
                {busy ? 'Drafting…' : 'Insert tailored'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? 'bg-green-100 text-green-900' : score >= 40 ? 'bg-yellow-100 text-yellow-900' : 'bg-gray-100 text-gray-600'
  return (
    <span className={`shrink-0 px-1.5 py-0.5 text-xs font-bold rounded ${tone}`}>
      {score}
    </span>
  )
}
