'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  CATEGORY_LABELS,
  type QuestionCategory,
  type QuestionSessionItem,
} from '@/lib/questions/types'

/**
 * Question session UI. Three states:
 *
 *   1. No session → "Generate" CTA. POSTs to /api/proposals/[id]/questions.
 *   2. Session loaded → linear list grouped by category, each with a textarea
 *      + per-question auto-save (debounced 1.5s on blur or typing pause).
 *   3. All required answered → "Mark complete" affordance.
 *
 * Auto-save fires PATCH /api/proposals/[id]/questions with {itemId, answer}.
 * Status pill shows answered count vs total + required-remaining.
 */

interface Props {
  proposalId: string
  initialSessionId: string | null
  initialStatus: 'in_progress' | 'complete' | 'abandoned' | null
  initialItems: QuestionSessionItem[]
}

export function QuestionSessionView({
  proposalId,
  initialSessionId,
  initialItems,
}: Props) {
  const [items, setItems] = useState<QuestionSessionItem[]>(initialItems)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
  const [generating, startGenerating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const generate = () => {
    setError(null)
    startGenerating(async () => {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/questions`, { method: 'POST' })
        if (!res.ok) {
          setError(`Generate failed: ${res.status} ${await res.text()}`)
          return
        }
        const { sessionId: newId } = await res.json()
        setSessionId(newId)
        // Re-fetch the items via a full page reload (server component repaints)
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Generate failed')
      }
    })
  }

  if (!sessionId) {
    return (
      <div className="rounded-md border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <h2 className="text-base font-semibold text-gray-900 mb-2">
          No question session yet
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          Generate a contract-specific question set for this proposal. Combines
          templated core questions (work-type aware) with AI-generated questions
          based on this RFP&rsquo;s requirements, your capability statement, and your
          past-performance library.
        </p>
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="px-5 py-2.5 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-50"
          style={{ backgroundColor: '#F5C518' }}
        >
          {generating ? 'Generating…' : 'Generate questions'}
        </button>
      </div>
    )
  }

  // Group items by category
  const grouped = new Map<QuestionCategory, QuestionSessionItem[]>()
  for (const it of items) {
    if (!grouped.has(it.category)) grouped.set(it.category, [])
    grouped.get(it.category)!.push(it)
  }

  const answered = items.filter((i) => i.answer && i.answer.trim().length > 0).length
  const requiredRemaining = items.filter(
    (i) => i.required && (!i.answer || i.answer.trim().length === 0),
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">
            {answered} of {items.length} answered
          </span>
          {requiredRemaining > 0 && (
            <span className="ml-3 text-yellow-700">
              · {requiredRemaining} required remaining
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-xs text-gray-600 hover:text-gray-900 underline"
        >
          {generating ? 'Regenerating…' : 'Regenerate session'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {Array.from(grouped.entries()).map(([category, catItems]) => (
        <section key={category}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-3">
            {CATEGORY_LABELS[category]} ({catItems.length})
          </h2>
          <div className="space-y-3">
            {catItems.map((it) => (
              <QuestionCard
                key={it.id}
                item={it}
                proposalId={proposalId}
                onAnswerChange={(newAnswer) =>
                  setItems((prev) =>
                    prev.map((p) =>
                      p.id === it.id
                        ? { ...p, answer: newAnswer, answered_at: newAnswer ? new Date().toISOString() : null }
                        : p,
                    ),
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function QuestionCard({
  item,
  proposalId,
  onAnswerChange,
}: {
  item: QuestionSessionItem
  proposalId: string
  onAnswerChange: (answer: string) => void
}) {
  const [draft, setDraft] = useState(item.answer ?? '')
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    item.answer ? 'saved' : 'idle',
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = async (val: string) => {
    setSavingState('saving')
    try {
      const res = await fetch(`/api/proposals/${proposalId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, answer: val }),
      })
      if (!res.ok) {
        setSavingState('error')
        return
      }
      setSavingState('saved')
      onAnswerChange(val)
    } catch {
      setSavingState('error')
    }
  }

  const onChange = (val: string) => {
    setDraft(val)
    setSavingState('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(val), 1500)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const sourcePill =
    item.source === 'template' ? (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
        TEMPLATE
      </span>
    ) : (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
        AI
      </span>
    )

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {item.question}
            {item.required && <span className="text-red-500 ml-1">*</span>}
          </p>
          {item.context && (
            <p className="text-xs text-gray-500 mt-1">{item.context}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">{sourcePill}</div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current)
          if (draft !== (item.answer ?? '')) flush(draft)
        }}
        placeholder="Your answer..."
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 min-h-20"
      />

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
          {item.category.replace(/_/g, ' ')}
        </span>
        <span
          className={`text-[10px] ${
            savingState === 'saving'
              ? 'text-blue-600'
              : savingState === 'saved'
                ? 'text-green-600'
                : savingState === 'error'
                  ? 'text-red-600'
                  : 'text-gray-500'
          }`}
        >
          {savingState === 'saving' && '· Saving…'}
          {savingState === 'saved' && '✓ Saved'}
          {savingState === 'error' && '✗ Save failed'}
        </span>
      </div>
    </div>
  )
}
