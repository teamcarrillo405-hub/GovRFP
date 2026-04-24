'use client'

import { useState, useEffect, useCallback } from 'react'
import { SECTION_NAMES } from '@/lib/editor/types'
import ColorTeamBadge, { type ColorTeamStatus } from './ColorTeamBadge'

interface Props {
  proposalId: string
  onStatusChange?: (sectionName: string, status: string) => void
}

interface SectionRow {
  sectionName: string
  status: ColorTeamStatus
  updatedAt: string | null
  notes: string
  // local draft state while the user edits the row before saving
  draftStatus: ColorTeamStatus
  draftNotes: string
  saving: boolean
  saved: boolean
}

const ALL_STATUSES: ColorTeamStatus[] = ['white', 'pink', 'red', 'gold', 'final']

const STATUS_LABEL: Record<ColorTeamStatus, string> = {
  white: 'White — not started',
  pink:  'Pink — first draft',
  red:   'Red — peer reviewed',
  gold:  'Gold — management approved',
  final: 'Final — locked',
}

const PROGRESS_COLOR: Record<ColorTeamStatus, string> = {
  white: 'bg-gray-300',
  pink:  'bg-pink-400',
  red:   'bg-red-500',
  gold:  'bg-yellow-500',
  final: 'bg-green-500',
}

// Progress weight per status (how "done" each stage is for the velocity bar)
const PROGRESS_WEIGHT: Record<ColorTeamStatus, number> = {
  white: 0,
  pink:  25,
  red:   50,
  gold:  75,
  final: 100,
}

function buildDefaultRows(): SectionRow[] {
  return SECTION_NAMES.map((name) => ({
    sectionName: name,
    status: 'white',
    updatedAt: null,
    notes: '',
    draftStatus: 'white',
    draftNotes: '',
    saving: false,
    saved: false,
  }))
}

export default function ColorTeamPanel({ proposalId, onStatusChange }: Props) {
  const [rows, setRows] = useState<SectionRow[]>(buildDefaultRows)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch current status on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)

    fetch(`/api/proposals/${proposalId}/sections/color-team`)
      .then((r) => r.json())
      .then((body: { sections?: Array<{ sectionName: string; status: ColorTeamStatus; updatedAt: string | null; notes: string }> }) => {
        if (cancelled) return
        const serverMap = new Map(
          (body.sections ?? []).map((s) => [s.sectionName, s])
        )
        setRows(
          SECTION_NAMES.map((name) => {
            const server = serverMap.get(name)
            const status: ColorTeamStatus = server?.status ?? 'white'
            const notes = server?.notes ?? ''
            return {
              sectionName: name,
              status,
              updatedAt: server?.updatedAt ?? null,
              notes,
              draftStatus: status,
              draftNotes: notes,
              saving: false,
              saved: false,
            }
          })
        )
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError('Failed to load color team status. Please refresh.')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [proposalId])

  const handleDraftStatus = useCallback((sectionName: string, value: ColorTeamStatus) => {
    setRows((prev) =>
      prev.map((r) => r.sectionName === sectionName ? { ...r, draftStatus: value } : r)
    )
  }, [])

  const handleDraftNotes = useCallback((sectionName: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => r.sectionName === sectionName ? { ...r, draftNotes: value } : r)
    )
  }, [])

  const handleSave = useCallback(async (sectionName: string) => {
    const row = rows.find((r) => r.sectionName === sectionName)
    if (!row) return

    setRows((prev) =>
      prev.map((r) => r.sectionName === sectionName ? { ...r, saving: true, saved: false } : r)
    )

    try {
      const res = await fetch(`/api/proposals/${proposalId}/sections/color-team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionName,
          status: row.draftStatus,
          notes: row.draftNotes,
        }),
      })

      if (!res.ok) {
        throw new Error('Server error')
      }

      const updated = await res.json() as { sectionName: string; status: ColorTeamStatus; updatedAt: string | null; notes: string }

      setRows((prev) =>
        prev.map((r) =>
          r.sectionName === sectionName
            ? {
                ...r,
                status: updated.status,
                updatedAt: updated.updatedAt,
                notes: updated.notes,
                draftStatus: updated.status,
                draftNotes: updated.notes,
                saving: false,
                saved: true,
              }
            : r
        )
      )

      onStatusChange?.(sectionName, updated.status)

      // Clear the "Saved" flash after 2 s
      setTimeout(() => {
        setRows((prev) =>
          prev.map((r) => r.sectionName === sectionName ? { ...r, saved: false } : r)
        )
      }, 2000)
    } catch {
      setRows((prev) =>
        prev.map((r) => r.sectionName === sectionName ? { ...r, saving: false } : r)
      )
    }
  }, [rows, proposalId, onStatusChange])

  // Summary counts
  const counts = ALL_STATUSES.reduce<Record<ColorTeamStatus, number>>(
    (acc, s) => {
      acc[s] = rows.filter((r) => r.status === s).length
      return acc
    },
    { white: 0, pink: 0, red: 0, gold: 0, final: 0 }
  )

  // Velocity bar — average progress across all sections
  const avgProgress =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + PROGRESS_WEIGHT[r.status], 0) / rows.length
        )
      : 0

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto font-sans">
        <p className="text-sm text-gray-400">Loading color team status…</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-8 max-w-4xl mx-auto font-sans">
        <p className="text-sm text-red-600">{fetchError}</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Color Team Review</h2>
            <p className="mt-1 text-xs text-gray-500 max-w-lg">
              Shipley Color Team methodology — Pink=first draft, Red=peer reviewed,
              Gold=management approved, Final=locked
            </p>
          </div>
          <div className="text-xs text-gray-500 text-right shrink-0">
            {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className="inline-flex items-center gap-1 mr-3">
                <ColorTeamBadge status={s} size="sm" />
                <span className="font-semibold text-gray-700">{counts[s]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Velocity progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Team velocity</span>
            <span className="text-xs font-semibold text-gray-700">{avgProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-yellow-500 transition-all duration-500"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-4 py-3 text-left font-medium">Section</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Change To</th>
              <th className="px-4 py-3 text-left font-medium">Notes</th>
              <th className="px-4 py-3 text-center font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const isDirty =
                row.draftStatus !== row.status || row.draftNotes !== row.notes

              return (
                <tr key={row.sectionName} className="bg-white hover:bg-gray-50 transition-colors">
                  {/* Section name */}
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {row.sectionName}
                  </td>

                  {/* Current status dot */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ColorTeamBadge status={row.status} size="md" />
                  </td>

                  {/* Dropdown */}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={row.draftStatus}
                      onChange={(e) =>
                        handleDraftStatus(row.sectionName, e.target.value as ColorTeamStatus)
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Notes input */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.draftNotes}
                      onChange={(e) => handleDraftNotes(row.sectionName, e.target.value)}
                      placeholder="Optional notes…"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </td>

                  {/* Save button */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {row.saved ? (
                      <span className="text-xs text-green-600 font-medium">Saved</span>
                    ) : (
                      <button
                        onClick={() => handleSave(row.sectionName)}
                        disabled={row.saving || !isDirty}
                        className={[
                          'rounded px-3 py-1 text-xs font-semibold transition-colors',
                          isDirty && !row.saving
                            ? 'bg-gray-900 text-white hover:bg-gray-700 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                        ].join(' ')}
                      >
                        {row.saving ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        {ALL_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full inline-block ${PROGRESS_COLOR[s]}`} />
            <span>
              {counts[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
