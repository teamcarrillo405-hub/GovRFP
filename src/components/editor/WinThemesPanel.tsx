'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'

interface Props {
  proposalId: string
  allSectionsText: Record<string, string> // sectionName -> plain text
}

// ─── Coverage helpers ─────────────────────────────────────────────────────────

/** Extract significant words (>4 chars) from a theme phrase */
function significantWords(theme: string): string[] {
  return theme
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-z]/g, '').length > 4)
}

/**
 * Returns true if any significant word from the theme appears
 * in the section text (case-insensitive).
 */
function themeAppears(theme: string, sectionText: string): boolean {
  if (!theme.trim()) return false
  const words = significantWords(theme)
  if (words.length === 0) return false
  const lower = sectionText.toLowerCase()
  return words.some((w) => lower.includes(w))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WinThemesPanel({ proposalId, allSectionsText }: Props) {
  const [themes, setThemes] = useState<string[]>([''])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load themes on mount ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/win-themes`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json() as { themes: string[] }
        const loaded = data.themes.length > 0 ? data.themes : ['']
        setThemes(loaded)
      } catch {
        setError('Could not load win themes.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [proposalId])

  // ── Save themes ───────────────────────────────────────────────────────────

  const saveThemes = useCallback(async (themesToSave: string[]) => {
    const cleaned = themesToSave.filter((t) => t.trim().length > 0)
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/win-themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themes: cleaned }),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      setError('Failed to save win themes.')
    } finally {
      setSaving(false)
    }
  }, [proposalId])

  // Auto-save on blur (debounced)
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void saveThemes(themes)
    }, 300)
  }, [themes, saveThemes])

  // ── Theme input management ────────────────────────────────────────────────

  function updateTheme(index: number, value: string) {
    setThemes((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function addTheme() {
    if (themes.length < 5) setThemes((prev) => [...prev, ''])
  }

  function removeTheme(index: number) {
    const next = themes.filter((_, i) => i !== index)
    const updated = next.length > 0 ? next : ['']
    setThemes(updated)
    void saveThemes(updated)
  }

  // ── AI Suggest ────────────────────────────────────────────────────────────

  async function handleSuggest() {
    setSuggesting(true)
    setError(null)
    try {
      // Send first section's content as context
      const sectionContent = Object.values(allSectionsText).slice(0, 2).join('\n\n').slice(0, 3000)
      const res = await fetch(`/api/proposals/${proposalId}/win-themes/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionContent }),
      })
      if (!res.ok) throw new Error('Suggest request failed')
      const data = await res.json() as { themes?: string[]; error?: string }
      if (data.error) throw new Error(data.error)
      const suggested = data.themes ?? []
      if (suggested.length > 0) {
        setThemes(suggested)
        void saveThemes(suggested)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed')
    } finally {
      setSuggesting(false)
    }
  }

  // ── Coverage matrix computation ───────────────────────────────────────────

  const activeThemes = themes.filter((t) => t.trim().length > 0)

  type CoverageMap = Record<string, Record<SectionName, boolean>>

  const coverage: CoverageMap = {}
  for (const theme of activeThemes) {
    coverage[theme] = {} as Record<SectionName, boolean>
    for (const section of SECTION_NAMES) {
      const text = allSectionsText[section] ?? ''
      coverage[theme][section] = themeAppears(theme, text)
    }
  }

  // Sections missing at least one theme
  const missingSections: { section: SectionName; missing: string[] }[] = SECTION_NAMES
    .map((section) => ({
      section,
      missing: activeThemes.filter((theme) => !coverage[theme]?.[section]),
    }))
    .filter(({ missing }) => missing.length > 0)

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-100 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-inter">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Win Themes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define 3–5 key differentiators to weave throughout every section of your proposal.
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Section 1: Define themes ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Define Win Themes</h3>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
            <button
              onClick={() => void handleSuggest()}
              disabled={suggesting}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-black transition-colors"
            >
              {suggesting ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Suggesting...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI Suggest
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          {themes.map((theme, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 w-5 text-right shrink-0">
                {index + 1}.
              </span>
              <input
                type="text"
                value={theme}
                onChange={(e) => updateTheme(index, e.target.value)}
                onBlur={handleBlur}
                placeholder={`Win theme ${index + 1} — e.g. "15 years of federal construction experience"`}
                className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
              />
              {themes.length > 1 && (
                <button
                  onClick={() => removeTheme(index)}
                  className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Remove theme"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {themes.length < 5 && (
            <button
              onClick={addTheme}
              className="ml-7 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-amber-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add theme ({themes.length}/5)
            </button>
          )}
        </div>
      </div>

      {/* ── Section 2: Coverage matrix ── */}
      {activeThemes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Coverage Matrix</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Green = theme keywords detected in that section. Red = missing.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 border-b border-gray-100 min-w-[180px]">
                    Win Theme
                  </th>
                  {SECTION_NAMES.map((section) => (
                    <th
                      key={section}
                      className="px-2 py-2.5 text-center font-medium text-gray-500 border-b border-gray-100 min-w-[90px]"
                    >
                      <span className="block leading-tight">{section}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeThemes.map((theme, themeIdx) => (
                  <tr key={themeIdx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-700 max-w-[180px]">
                      <span className="line-clamp-2 leading-snug">{theme}</span>
                    </td>
                    {SECTION_NAMES.map((section) => (
                      <td key={section} className="px-2 py-2.5 text-center">
                        {coverage[theme]?.[section]
                          ? <CheckIcon />
                          : <XIcon />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 3: Missing coverage callouts ── */}
      {activeThemes.length > 0 && missingSections.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">Missing Coverage</h3>
          <div className="space-y-2">
            {missingSections.map(({ section, missing }) => (
              <div
                key={section}
                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <svg className="mt-0.5 w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-amber-900">{section}</span>
                  <span className="text-sm text-amber-700"> is missing: </span>
                  <span className="text-sm text-amber-800 italic">
                    {missing.map((t, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        &lsquo;{t}&rsquo;
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All covered state ── */}
      {activeThemes.length > 0 && missingSections.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-green-800">
            All win themes are covered across every section.
          </span>
        </div>
      )}
    </div>
  )
}
