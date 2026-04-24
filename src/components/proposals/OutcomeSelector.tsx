'use client'

import { useState } from 'react'
import Link from 'next/link'

type Outcome = 'won' | 'lost' | 'no_bid' | 'pending'

interface OutcomeSelectorProps {
  proposalId: string
  currentOutcome: string | null
  contractValue: number | null
  ppRecordId?: string | null
}

const OUTCOMES: { value: Outcome; label: string; activeClasses: string; hoverClasses: string }[] = [
  {
    value: 'won',
    label: 'Won',
    activeClasses: 'bg-green-600 border-green-600 text-white',
    hoverClasses: 'hover:border-green-500 hover:text-green-700',
  },
  {
    value: 'lost',
    label: 'Lost',
    activeClasses: 'bg-red-500 border-red-500 text-white',
    hoverClasses: 'hover:border-red-400 hover:text-red-600',
  },
  {
    value: 'no_bid',
    label: 'No Bid',
    activeClasses: 'bg-gray-600 border-gray-600 text-white',
    hoverClasses: 'hover:border-gray-400 hover:text-gray-600',
  },
  {
    value: 'pending',
    label: 'Pending',
    activeClasses: 'bg-yellow-400 border-yellow-400 text-black',
    hoverClasses: 'hover:border-yellow-400 hover:text-yellow-700',
  },
]

export default function OutcomeSelector({
  proposalId,
  currentOutcome,
  contractValue: initialContractValue,
  ppRecordId: initialPpRecordId = null,
}: OutcomeSelectorProps) {
  const [selected, setSelected] = useState<Outcome | null>(
    (currentOutcome as Outcome) ?? null
  )
  const [contractValue, setContractValue] = useState<string>(
    initialContractValue !== null ? String(initialContractValue) : ''
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  // ppRecordId tracks the linked Past Performance record for the *saved* outcome.
  // It is only shown (and only meaningful) when the saved outcome is Won.
  const [ppRecordId, setPpRecordId] = useState<string | null>(initialPpRecordId)
  // savedOutcome mirrors the last successfully persisted outcome so we can
  // correctly gate PP callout visibility even if the user has changed the
  // local selection without saving yet.
  const [savedOutcome, setSavedOutcome] = useState<Outcome | null>(
    (currentOutcome as Outcome) ?? null
  )

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setToast(null)

    try {
      const body: Record<string, unknown> = { outcome: selected }
      if (contractValue.trim() !== '') {
        const parsed = parseFloat(contractValue.replace(/[^0-9.]/g, ''))
        if (!isNaN(parsed)) body.contract_value = parsed
      }
      if (notes.trim()) body.outcome_notes = notes.trim()

      const res = await fetch(`/api/proposals/${proposalId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Save failed')
      }

      const data = await res.json().catch(() => ({})) as { pp_record_id?: string | null }

      // Update saved outcome so callout visibility is based on what is
      // actually persisted, not the local selection.
      setSavedOutcome(selected)

      if (selected === 'won') {
        // Capture the returned PP record id (auto-created or existing).
        setPpRecordId(data.pp_record_id ?? null)
      } else {
        // Changing away from Won: clear the local PP record ref so the
        // callout disappears. The DB record still exists — this only
        // hides the UI prompt for the new non-Won outcome.
        setPpRecordId(null)
      }

      setToast({ type: 'success', message: 'Outcome saved!' })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  // The PP callout is relevant only when the saved outcome is Won.
  const showPpCallout = savedOutcome === 'won'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <h3 className="text-sm font-bold text-gray-900">Proposal Outcome</h3>

      {/* Outcome buttons */}
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map(({ value, label, activeClasses, hoverClasses }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={[
              'px-3.5 py-1.5 rounded-lg border-2 text-sm font-bold transition-all duration-150',
              selected === value
                ? activeClasses
                : `border-gray-200 text-gray-500 bg-white ${hoverClasses}`,
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contract value — show when Won is selected */}
      {selected === 'won' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Contract Value ($)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
            placeholder="e.g. 250000"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FDFF66] focus:border-transparent placeholder:text-gray-300"
          />
        </div>
      )}

      {/* Notes textarea */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? Key factors, debrief notes..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#FDFF66] focus:border-transparent placeholder:text-gray-300"
        />
      </div>

      {/* Save + toast row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!selected || saving}
          className="px-4 py-2 bg-[#FDFF66] text-black text-sm font-black rounded-lg hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Outcome'}
        </button>

        {toast && (
          <span
            className={`text-sm font-semibold ${
              toast.type === 'success' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {toast.message}
          </span>
        )}
      </div>

      {/* PP callout — only when the *saved* outcome is Won */}
      {showPpCallout && (
        ppRecordId ? (
          /* PP record already exists: show link to it */
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-green-800">Past Performance record linked</p>
              <p className="text-xs text-green-700 mt-0.5">Pre-filled from this proposal. Add your performance narrative.</p>
            </div>
            <Link
              href={`/past-performance/${ppRecordId}`}
              className="shrink-0 text-xs font-bold text-green-900 underline hover:no-underline"
            >
              View record →
            </Link>
          </div>
        ) : (
          /* Won but no PP record yet — prompt to create one manually */
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-green-800">Add this win to your Past Performance library</p>
              <p className="text-xs text-green-700 mt-0.5">Document this contract for future RFP proposals.</p>
            </div>
            <Link
              href={`/past-performance/new?from=proposal&proposalId=${proposalId}`}
              className="shrink-0 text-xs font-bold text-green-900 underline hover:no-underline"
            >
              Create record →
            </Link>
          </div>
        )
      )}
    </div>
  )
}
