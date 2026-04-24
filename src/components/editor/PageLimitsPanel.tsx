'use client'

import { useState, useEffect, useCallback } from 'react'
import { SECTION_NAMES } from '@/lib/editor/types'
import {
  countWords,
  countPages,
  computeSectionWordCount,
  type SectionWordCount,
} from '@/lib/editor/word-count'

interface Props {
  allSectionsText: Record<string, string>
  proposalId: string
}

interface SectionLimits {
  words?: number
  pages?: number
}

type LimitsMap = Record<string, SectionLimits>

function storageKey(proposalId: string) {
  return `page-limits-v1:${proposalId}`
}

function loadLimits(proposalId: string): LimitsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(proposalId))
    return raw ? (JSON.parse(raw) as LimitsMap) : {}
  } catch {
    return {}
  }
}

function saveLimits(proposalId: string, limits: LimitsMap) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(proposalId), JSON.stringify(limits))
  } catch {
    // Storage unavailable — silently ignore
  }
}

function wordsPerPageKey(proposalId: string) {
  return `words-per-page-v1:${proposalId}`
}

function loadWordsPerPage(proposalId: string): number {
  if (typeof window === 'undefined') return 250
  try {
    const raw = localStorage.getItem(wordsPerPageKey(proposalId))
    const parsed = raw ? parseInt(raw, 10) : NaN
    return isNaN(parsed) || parsed < 1 ? 250 : parsed
  } catch {
    return 250
  }
}

function StatusBadge({ row }: { row: SectionWordCount }) {
  if (row.limitWords === null && row.limitPages === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        No limit
      </span>
    )
  }

  if (row.status === 'over') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Over limit
      </span>
    )
  }

  if (row.status === 'warning') {
    const pct =
      row.limitWords !== null
        ? Math.round((row.words / row.limitWords) * 100)
        : row.limitPages !== null
        ? Math.round((row.pages / row.limitPages) * 100)
        : 0
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
        {pct}% used
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      OK
    </span>
  )
}

export default function PageLimitsPanel({ allSectionsText, proposalId }: Props) {
  const [limits, setLimits] = useState<LimitsMap>({})
  const [wordsPerPage, setWordsPerPage] = useState(250)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setLimits(loadLimits(proposalId))
    setWordsPerPage(loadWordsPerPage(proposalId))
    setMounted(true)
  }, [proposalId])

  const updateLimit = useCallback(
    (section: string, field: 'words' | 'pages', raw: string) => {
      const parsed = parseInt(raw, 10)
      const value = isNaN(parsed) || parsed < 1 ? undefined : parsed

      setLimits((prev) => {
        const next: LimitsMap = {
          ...prev,
          [section]: { ...prev[section], [field]: value },
        }
        // Clean up empty objects
        if (!next[section].words && !next[section].pages) {
          delete next[section]
        }
        saveLimits(proposalId, next)
        return next
      })
    },
    [proposalId],
  )

  const handleWordsPerPage = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10)
      const value = isNaN(parsed) || parsed < 1 ? 250 : parsed
      setWordsPerPage(value)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(wordsPerPageKey(proposalId), String(value))
        } catch {
          // ignore
        }
      }
    },
    [proposalId],
  )

  const rows: SectionWordCount[] = SECTION_NAMES.map((name) => {
    const text = allSectionsText[name] ?? ''
    const sectionLimits = limits[name] ?? {}
    return computeSectionWordCount(
      name,
      text,
      sectionLimits.words ?? null,
      sectionLimits.pages ?? null,
      wordsPerPage,
    )
  })

  const totalWords = rows.reduce((sum, r) => sum + r.words, 0)
  const totalPages = Math.ceil(totalWords / wordsPerPage)

  if (!mounted) {
    // Render a skeleton-like placeholder to avoid hydration issues
    return (
      <div className="p-8 max-w-4xl mx-auto font-sans">
        <p className="text-sm text-gray-400">Loading limits…</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Page &amp; Word Limits</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>Words per page:</span>
          <input
            type="number"
            min={1}
            defaultValue={wordsPerPage}
            onBlur={(e) => handleWordsPerPage(e.target.value)}
            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-4 py-3 text-left font-medium">Section</th>
              <th className="px-4 py-3 text-right font-medium">Words</th>
              <th className="px-4 py-3 text-right font-medium">Pages</th>
              <th className="px-4 py-3 text-center font-medium">Word Limit</th>
              <th className="px-4 py-3 text-center font-medium">Page Limit</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const isOver = row.status === 'over'
              const isWarn = row.status === 'warning'
              const rowBg = isOver
                ? 'bg-red-50'
                : isWarn
                ? 'bg-yellow-50'
                : 'bg-white'

              return (
                <tr key={row.sectionName} className={`${rowBg} hover:bg-gray-50 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {row.sectionName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {row.words.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {row.pages}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      placeholder="—"
                      defaultValue={limits[row.sectionName]?.words ?? ''}
                      onBlur={(e) => updateLimit(row.sectionName, 'words', e.target.value)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      placeholder="—"
                      defaultValue={limits[row.sectionName]?.pages ?? ''}
                      onBlur={(e) => updateLimit(row.sectionName, 'pages', e.target.value)}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge row={row} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Total:{' '}
          <span className="font-semibold text-gray-900">{totalWords.toLocaleString()} words</span>
          {' · '}
          <span className="font-semibold text-gray-900">{totalPages} pages</span> estimated
        </p>
        <p className="text-xs text-gray-400 italic max-w-xs text-right">
          Most solicitations allow 250 words/page. Adjust above to match Section L instructions.
        </p>
      </div>
    </div>
  )
}
