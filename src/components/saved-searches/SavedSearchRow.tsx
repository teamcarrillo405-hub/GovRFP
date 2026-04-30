'use client'

import { useState, useTransition } from 'react'
import { deleteSearchAction, updateSearchAction } from '@/app/(dashboard)/saved-searches/actions'
import { summarizeFilters, type SavedSearch } from '@/lib/saved-searches-types'

interface Props {
  search: SavedSearch
}

export function SavedSearchRow({ search }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(search.name)
  const [enabled, setEnabled] = useState(search.alerts_enabled)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [alertError, setAlertError] = useState<string | null>(null)

  const filterSummary = summarizeFilters(search.filters)
  const lastAlerted = search.last_alerted_at
    ? new Date(search.last_alerted_at).toLocaleString()
    : 'never'

  const onToggleAlerts = () => {
    const next = !enabled
    setEnabled(next)
    setAlertError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/saved-searches/${search.id}/alerts`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alerts_enabled: next }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setAlertError((body as { error?: string }).error ?? 'Failed to update')
          setEnabled(!next)
        }
      } catch {
        setAlertError('Network error')
        setEnabled(!next)
      }
    })
  }

  const onSaveEdit = () => {
    startTransition(async () => {
      await updateSearchAction(search.id, { name })
      setEditing(false)
    })
  }

  const onDelete = () => {
    startTransition(async () => { await deleteSearchAction(search.id) })
  }

  const queryString = new URLSearchParams(
    Object.entries(search.filters).filter(([, v]) => v != null) as [string, string][]
  ).toString()

  return (
    <div className="border border-white/10 rounded-xl p-4 flex items-start justify-between gap-4 bg-white/5">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-white/20 bg-white/10 rounded-lg px-2 py-1 mb-1 font-semibold text-gray-100 focus:border-red-500 focus:outline-none transition-colors"
            autoFocus
          />
        ) : (
          <h3 className="font-semibold text-gray-100 truncate">{search.name}</h3>
        )}
        <p className="text-sm text-gray-400 truncate">{filterSummary}</p>
        <p className="text-xs text-gray-500 mt-1">Last alerted: {lastAlerted}</p>
        {alertError && <p className="text-xs text-red-400 mt-1">{alertError}</p>}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleAlerts}
          disabled={isPending}
          title={enabled ? 'Turn off email alerts' : 'Turn on email alerts'}
          className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wide transition-colors ${
            enabled ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/10 text-gray-400 hover:bg-white/20'
          } disabled:opacity-50`}
        >
          {enabled ? 'Alerts On' : 'Alerts Off'}
        </button>

        <div className="flex gap-2">
          <a
            href={`/opportunities?${queryString}`}
            className="px-2 py-1 text-xs rounded-lg border border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200 transition-colors"
          >
            View
          </a>
          {editing ? (
            <button type="button" onClick={onSaveEdit} disabled={isPending}
              className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition-all">
              Save
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} disabled={isPending}
              className="px-2 py-1 text-xs rounded-lg border border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200 transition-colors">
              Edit
            </button>
          )}
          {confirmDelete ? (
            <button type="button" onClick={onDelete} disabled={isPending}
              className="px-2 py-1 text-xs rounded-lg bg-red-700 text-white font-medium">
              Confirm
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={isPending}
              className="px-2 py-1 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-950/30 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
