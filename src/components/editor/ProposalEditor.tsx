'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { JSONContent } from '@tiptap/react'
import type { ProposalSection, SectionName, ComplianceCoverage } from '@/lib/editor/types'
import { SECTION_NAMES } from '@/lib/editor/types'
import { stripComplianceMarks } from '@/lib/editor/compliance-gap-mark'
import { scanCompliance } from '@/lib/editor/compliance-scanner'
import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'
import type { RfpStructure } from '@/lib/documents/rfp-structure'
import SectionEditor, { type SectionEditorHandle } from './SectionEditor'
import EditorToolbar from './EditorToolbar'
import CompliancePanel from './CompliancePanel'
import RegenerateDialog from './RegenerateDialog'
import RfpStructureSidebar from './RfpStructureSidebar'
import { PastPerformancePanel } from './PastPerformancePanel'
import ScoringRubricPanel from './ScoringRubricPanel'
import { markdownToBasicHtml } from '@/lib/editor/markdown-to-html'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

type ToolView = 'rfp-structure' | 'compliance' | 'past-performance' | 'scoring'
type ActiveView = SectionName | ToolView

interface SectionState {
  content: JSONContent | null
  draftStatus: ProposalSection['draft_status']
  lastSavedAt: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  proposalId: string
  initialSections: ProposalSection[]
  requirements: AnalysisRequirement[]
  complianceMatrix: ComplianceMatrixRow[]
  rfpStructure: RfpStructure | null
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initSectionsMap(initialSections: ProposalSection[]): Map<SectionName, SectionState> {
  const map = new Map<SectionName, SectionState>()
  for (const name of SECTION_NAMES) {
    const found = initialSections.find((s) => s.section_name === name)
    map.set(name, {
      content: found?.content ?? null,
      draftStatus: found?.draft_status ?? 'empty',
      lastSavedAt: found?.last_saved_at ?? null,
    })
  }
  return map
}

function isSectionName(view: ActiveView): view is SectionName {
  return (SECTION_NAMES as readonly string[]).includes(view)
}

// Recursively extract plain text from TipTap JSONContent
function extractPlainText(content: import('@tiptap/react').JSONContent | null): string {
  if (!content) return ''
  const parts: string[] = []
  if (typeof content.text === 'string') {
    parts.push(content.text)
  }
  if (Array.isArray(content.content)) {
    for (const child of content.content) {
      parts.push(extractPlainText(child))
    }
  }
  return parts.join(' ')
}

// Status dot color per draft status
function sectionDotClass(draftStatus: ProposalSection['draft_status']): string {
  if (draftStatus === 'edited' || draftStatus === 'draft') {
    return draftStatus === 'edited' ? 'bg-green-500' : 'bg-yellow-400'
  }
  return 'bg-gray-300'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProposalEditor({
  proposalId,
  initialSections,
  requirements,
  complianceMatrix,
  rfpStructure,
  className = '',
}: Props) {
  const [activeView, setActiveView] = useState<ActiveView>('Executive Summary')
  const [sections, setSections] = useState<Map<SectionName, SectionState>>(
    () => initSectionsMap(initialSections)
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [watchdogStatus, setWatchdogStatus] = useState<string | null>(null)
  const [watchdogScore, setWatchdogScore] = useState<{ score: number; passed: boolean; attempt: number } | null>(null)
  const [complianceCoverage, setComplianceCoverage] = useState<Map<SectionName, ComplianceCoverage>>(
    new Map()
  )
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [activeRfpSection, setActiveRfpSection] = useState<string | null>(null)

  // Refs for interval logic (avoid stale closures)
  const editorRef = useRef<SectionEditorHandle>(null)
  const isDirtyRef = useRef(false)
  const isSavingRef = useRef(false)
  const isStreamingRef = useRef(false)
  // lastActiveSectionRef tracks the most recently active section so that
  // save/watchdog logic always has a valid SectionName even when a tool is active.
  const lastActiveSectionRef = useRef<SectionName>('Executive Summary')
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep lastActiveSectionRef in sync whenever a section is active
  useEffect(() => {
    if (isSectionName(activeView)) {
      lastActiveSectionRef.current = activeView
    }
  }, [activeView])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  // The currently active SectionName (falls back to last known)
  const activeSection: SectionName = isSectionName(activeView)
    ? activeView
    : lastActiveSectionRef.current

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveCurrentSection = useCallback(
    async (sectionName: SectionName, status: 'draft' | 'edited' = 'edited') => {
      const editor = editorRef.current?.editor
      if (!editor) return
      if (isSavingRef.current) return

      isSavingRef.current = true
      setSaveStatus('saving')

      const json = editor.getJSON()
      const cleanJson = stripComplianceMarks(json)

      try {
        const res = await fetch(`/api/proposals/${proposalId}/sections`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_name: sectionName,
            content: cleanJson,
            draft_status: status,
          }),
        })

        if (!res.ok) throw new Error('Save failed')

        const now = new Date().toLocaleTimeString()
        setSections((prev) => {
          const next = new Map(prev)
          const existing = next.get(sectionName) ?? { content: null, draftStatus: 'empty', lastSavedAt: null }
          next.set(sectionName, { ...existing, content: cleanJson, draftStatus: status, lastSavedAt: now })
          return next
        })
        setSaveStatus('saved')
        isDirtyRef.current = false

        // Run compliance scan after save
        const coverage = scanCompliance(cleanJson, requirements, sectionName)
        setComplianceCoverage((prev) => {
          const next = new Map(prev)
          next.set(sectionName, coverage)
          return next
        })
      } catch {
        setSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    },
    [proposalId, requirements]
  )

  // 30-second auto-save interval
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (!isDirtyRef.current || isSavingRef.current || isStreamingRef.current) return
      saveCurrentSection(lastActiveSectionRef.current, 'edited')
    }, 30_000)

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    }
  }, [saveCurrentSection])

  // ── Section switch ────────────────────────────────────────────────────────

  const handleSectionSwitch = async (section: SectionName) => {
    if (isStreaming) return
    if (section === activeView) return

    // Save current section if dirty before switching
    if (isDirtyRef.current && isSectionName(activeView)) {
      await saveCurrentSection(activeView, 'edited')
    }
    setActiveView(section)
    isDirtyRef.current = false
  }

  // ── Editor update ─────────────────────────────────────────────────────────

  const handleEditorUpdate = useCallback((json: JSONContent) => {
    isDirtyRef.current = true
    setSections((prev) => {
      const next = new Map(prev)
      const existing = next.get(lastActiveSectionRef.current)
      if (existing) {
        next.set(lastActiveSectionRef.current, { ...existing, content: json })
      }
      return next
    })
  }, [])

  // ── Past Performance insert ───────────────────────────────────────────────

  const handleInsertPpNarrative = useCallback((markdown: string) => {
    const editor = editorRef.current?.editor
    if (!editor) return
    const html = markdownToBasicHtml(markdown)
    editor.chain().focus('end').insertContent(html).run()
    isDirtyRef.current = true
    toast.success('Past Performance narrative inserted', {
      description: `Added to ${lastActiveSectionRef.current}`,
    })
  }, [])

  // ── RFP section scroll ────────────────────────────────────────────────────

  const handleRfpSectionClick = useCallback((sectionTitle: string) => {
    const editor = editorRef.current?.editor
    if (!editor) return

    let targetPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false
      if (node.type.name === 'heading' && node.textContent.toLowerCase().includes(sectionTitle.toLowerCase())) {
        targetPos = pos
        return false
      }
    })

    if (targetPos !== null) {
      editor.commands.setTextSelection(targetPos)
      editor.commands.scrollIntoView()
      editor.commands.focus()
    }
  }, [])

  // ── Active RFP section detection ──────────────────────────────────────────

  const detectActiveRfpSection = useCallback(() => {
    const editor = editorRef.current?.editor
    if (!editor || !rfpStructure) return

    const { from } = editor.state.selection
    let nearestHeading: string | null = null

    editor.state.doc.nodesBetween(0, from, (node) => {
      if (node.type.name === 'heading') {
        const headingText = node.textContent
        const matchedSection = rfpStructure.sections.find(
          (s) => headingText.toLowerCase().includes(s.title.toLowerCase())
        )
        if (matchedSection) {
          nearestHeading = matchedSection.number
        }
      }
    })

    setActiveRfpSection(nearestHeading)
  }, [rfpStructure])

  useEffect(() => {
    const editor = editorRef.current?.editor
    if (!editor) return

    const handler = () => detectActiveRfpSection()
    editor.on('selectionUpdate', handler)
    editor.on('update', handler)

    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('update', handler)
    }
  }, [detectActiveRfpSection])

  useEffect(() => {
    const timer = setTimeout(() => detectActiveRfpSection(), 500)
    return () => clearTimeout(timer)
  }, [detectActiveRfpSection, activeView])

  // ── Generate (Quality Watchdog loop) ─────────────────────────────────────

  const handleGenerate = async (section: SectionName, instruction?: string) => {
    if (isStreaming) return

    setIsStreaming(true)
    isStreamingRef.current = true
    setStreamBuffer('')
    setWatchdogStatus('Starting quality watchdog...')
    setWatchdogScore(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, instruction }),
      })

      if (!res.ok || !res.body) throw new Error('Generation failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let finalContent = ''

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (!value) continue

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const evt = JSON.parse(data)
            if (evt.type === 'watchdog_status') {
              setWatchdogStatus(evt.message)
            } else if (evt.type === 'watchdog_score') {
              setWatchdogScore({ score: evt.score, passed: evt.passed, attempt: evt.attempt })
              setWatchdogStatus(
                evt.passed
                  ? `Score ${evt.score}/100 — approved`
                  : `Score ${evt.score}/100 — below threshold, redrafting...`
              )
            } else if (evt.type === 'watchdog_approved' || evt.type === 'watchdog_failed') {
              finalContent = evt.content ?? ''
              setWatchdogStatus(
                evt.type === 'watchdog_approved'
                  ? `Approved ${evt.score}/100 — writing to editor`
                  : `Released best-effort draft (${evt.last_score}/100 after ${evt.attempts} attempts)`
              )
            }
          } catch {
            // non-JSON line — skip
          }
        }
      }

      const editor = editorRef.current?.editor
      if (editor && finalContent) {
        editor.commands.setContent(finalContent)
        isDirtyRef.current = true
      }

      setSections((prev) => {
        const next = new Map(prev)
        const existing = next.get(section) ?? { content: null, draftStatus: 'empty', lastSavedAt: null }
        next.set(section, { ...existing, draftStatus: 'draft' })
        return next
      })

      await saveCurrentSection(section, 'draft')
      if (finalContent) {
        const score = watchdogScore
        toast.success(
          score?.passed ? `${section} approved (${score.score}/100)` : `${section} draft ready`,
          { description: score?.passed ? 'Quality watchdog approved this draft.' : 'Best-effort draft after 3 attempts — review and edit as needed.' }
        )
      }
    } catch (err) {
      console.error('Generation error:', err)
      setSaveStatus('error')
      setWatchdogStatus('Generation failed — please retry')
      toast.error('Draft generation failed', { description: 'Check your connection and try again.' })
    } finally {
      setIsStreaming(false)
      isStreamingRef.current = false
      setStreamBuffer('')
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const currentSectionState = sections.get(activeSection)
  const hasContent =
    currentSectionState?.draftStatus !== 'empty' &&
    currentSectionState?.content !== null

  const currentCoverage = complianceCoverage.get(activeSection) ?? new Map()
  const editor = editorRef.current?.editor
  const isToolView = !isSectionName(activeView)

  // ── Nav button styles ─────────────────────────────────────────────────────

  const navItemBase = 'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left'
  const navItemActive = 'bg-white text-gray-900 shadow-sm font-semibold border border-gray-200'
  const navItemInactive = 'text-gray-600 hover:bg-gray-100'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex overflow-hidden ${className}`}>
      {/* ── Left navigation sidebar ── */}
      <nav
        className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col"
        aria-label="Proposal navigation"
      >
        <div className="p-3 flex flex-col gap-1">
          {/* SECTIONS group */}
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Sections
          </p>

          {SECTION_NAMES.map((section) => {
            const state = sections.get(section)
            const isActive = activeView === section
            return (
              <button
                key={section}
                onClick={() => handleSectionSwitch(section)}
                disabled={isStreaming}
                className={`${navItemBase} ${isActive ? navItemActive : navItemInactive} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Status dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${sectionDotClass(state?.draftStatus ?? 'empty')}`}
                  aria-hidden="true"
                />
                <span className="truncate">{section}</span>
              </button>
            )
          })}

          {/* TOOLS group */}
          <p className="px-3 pt-5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Tools
          </p>

          {(
            [
              { id: 'rfp-structure', label: 'RFP Structure' },
              { id: 'compliance', label: 'Compliance' },
              { id: 'past-performance', label: 'Past Performance' },
              { id: 'scoring', label: 'Scoring Rubric' },
            ] as { id: ToolView; label: string }[]
          ).map(({ id, label }) => {
            const isActive = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`${navItemBase} ${isActive ? navItemActive : navItemInactive}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* SECTION VIEW */}
        {isSectionName(activeView) && (
          <>
            {/* Toolbar */}
            <div className="shrink-0">
              <EditorToolbar editor={editor ?? null} />
            </div>

            {/* Scrollable editor canvas */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto w-full px-12 py-8">
                <SectionEditor
                  ref={editorRef}
                  content={currentSectionState?.content ?? null}
                  onUpdate={handleEditorUpdate}
                  isStreaming={isStreaming}
                  streamBuffer={streamBuffer}
                />

                {/* Empty state */}
                {!hasContent && !isStreaming && (
                  <div className="border border-t-0 border-gray-200 bg-gray-50 px-6 py-4 rounded-b-md">
                    <p className="text-sm text-gray-500 font-medium">No draft yet</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Click Generate {activeSection} to create an AI draft based on your contractor
                      profile and RFP requirements.
                    </p>
                  </div>
                )}

                {/* Quality Watchdog status bar */}
                {isStreaming && watchdogStatus && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-yellow-50 border border-t-0 border-yellow-200 text-xs">
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-yellow-600 shrink-0"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span className="text-yellow-800 font-medium">Quality Watchdog:</span>
                    <span className="text-yellow-700 flex-1 truncate">{watchdogStatus}</span>
                    {watchdogScore && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${
                          watchdogScore.passed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {watchdogScore.score}/100
                      </span>
                    )}
                  </div>
                )}

                {/* Generate / save bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-t-0 border-gray-200 rounded-b-md mt-0">
                  {/* Auto-save indicator */}
                  <div>
                    {saveStatus === 'saving' && (
                      <span className="flex items-center gap-1.5 text-xs text-blue-600">
                        <svg
                          className="animate-spin h-3 w-3"
                          xmlns="http://www.w3.org/2000/svg"
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
                        Saving...
                      </span>
                    )}
                    {saveStatus === 'saved' && currentSectionState?.lastSavedAt && (
                      <span className="text-xs text-gray-500">
                        Saved at {currentSectionState.lastSavedAt}
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-xs text-red-600">Save failed — check connection</span>
                    )}
                    {saveStatus === 'idle' && !currentSectionState?.lastSavedAt && (
                      <span className="text-xs text-gray-500">Not yet saved</span>
                    )}
                    {saveStatus === 'idle' && currentSectionState?.lastSavedAt && (
                      <span className="text-xs text-gray-500">
                        Saved at {currentSectionState.lastSavedAt}
                      </span>
                    )}
                    {isStreaming && !watchdogStatus && (
                      <span className="text-xs text-blue-600">Generating...</span>
                    )}
                  </div>

                  {/* Generate / Regenerate button */}
                  <div className="flex items-center gap-3">
                    {hasContent ? (
                      <button
                        onClick={() => setShowRegenerateDialog(true)}
                        disabled={isStreaming}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Regenerate Section
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerate(activeSection)}
                        disabled={isStreaming}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Generate {activeSection}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TOOL VIEWS */}
        {isToolView && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full px-8 py-8">

              {activeView === 'rfp-structure' && (
                <RfpStructureSidebar
                  rfpStructure={rfpStructure}
                  activeRfpSection={activeRfpSection}
                  onSectionClick={handleRfpSectionClick}
                />
              )}

              {activeView === 'compliance' && (
                <CompliancePanel
                  requirements={requirements}
                  coverage={currentCoverage}
                  sectionName={activeSection}
                />
              )}

              {activeView === 'past-performance' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <PastPerformancePanel
                    proposalId={proposalId}
                    onInsertNarrative={handleInsertPpNarrative}
                  />
                </div>
              )}

              {activeView === 'scoring' && (
                <ScoringRubricPanel
                  proposalId={proposalId}
                  sectionName={activeSection}
                  plainText={extractPlainText(sections.get(activeSection)?.content ?? null)}
                  requirements={requirements}
                  complianceMatrix={complianceMatrix}
                />
              )}

            </div>
          </div>
        )}
      </div>

      {/* Regenerate dialog */}
      <RegenerateDialog
        isOpen={showRegenerateDialog}
        sectionName={activeSection}
        onConfirm={(instruction) => {
          setShowRegenerateDialog(false)
          handleGenerate(activeSection, instruction)
        }}
        onCancel={() => setShowRegenerateDialog(false)}
      />
    </div>
  )
}
