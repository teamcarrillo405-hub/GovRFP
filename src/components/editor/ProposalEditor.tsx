'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
import SectionPreflightModal from './SectionPreflightModal'
import RfpStructureSidebar from './RfpStructureSidebar'
import { PastPerformancePanel } from './PastPerformancePanel'
import ScoringRubricPanel from './ScoringRubricPanel'
import GrammarPanel from './GrammarPanel'
import GrammarPopover from './GrammarPopover'
import type { GrammarIssue } from '@/lib/editor/grammar-analyzer'
import type { GrammarClickPayload } from '@/lib/editor/grammar-decoration-extension'
import { grammarPluginKey, grammarDismissKey } from '@/lib/editor/grammar-decoration-extension'
import WinThemesPanel from './WinThemesPanel'
import PageLimitsPanel from './PageLimitsPanel'
import ColorTeamPanel from './ColorTeamPanel'
import ColorTeamBadge, { type ColorTeamStatus } from './ColorTeamBadge'
import { CustomTemplateUpload } from './CustomTemplateUpload'
import WritingGuidancePanel from './WritingGuidancePanel'
import { markdownToBasicHtml } from '@/lib/editor/markdown-to-html'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

type ToolView =
  | 'rfp-structure'
  | 'compliance'
  | 'past-performance'
  | 'scoring'
  | 'grammar'
  | 'win-themes'
  | 'page-limits'
  | 'color-team'
  | 'custom-template'
  | 'writing-guidance'

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
  const [preflightGaps, setPreflightGaps] = useState<string[]>([])
  const [pendingSection, setPendingSection] = useState<SectionName | null>(null)
  const [showPreflightModal, setShowPreflightModal] = useState(false)
  const [colorTeamStatus, setColorTeamStatus] = useState<Record<string, ColorTeamStatus>>(
    () => Object.fromEntries(SECTION_NAMES.map((n) => [n, 'white' as ColorTeamStatus]))
  )
  const [inlineGrammarIssues, setInlineGrammarIssues] = useState<GrammarIssue[]>([])
  const [dismissedGrammarTexts, setDismissedGrammarTexts] = useState<Set<string>>(new Set())
  const [grammarPopover, setGrammarPopover] = useState<GrammarClickPayload | null>(null)

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

  // Fetch color team status on mount
  useEffect(() => {
    fetch(`/api/proposals/${proposalId}/sections/color-team`)
      .then((r) => r.json())
      .then((body: { sections?: Array<{ sectionName: string; status: ColorTeamStatus }> }) => {
        const map: Record<string, ColorTeamStatus> = {}
        for (const s of body.sections ?? []) {
          map[s.sectionName] = s.status
        }
        setColorTeamStatus((prev) => ({ ...prev, ...map }))
      })
      .catch(() => {
        // Non-fatal — badges will show 'white' as default
      })
  }, [proposalId])

  // The currently active SectionName (falls back to last known)
  const activeSection: SectionName = isSectionName(activeView)
    ? activeView
    : lastActiveSectionRef.current

  // ── allSectionsText ───────────────────────────────────────────────────────

  const allSectionsText = useMemo(() => {
    const result: Record<string, string> = {}
    for (const [name, state] of sections.entries()) {
      result[name] = state.content ? extractPlainText(state.content) : ''
    }
    return result
  }, [sections])

  // ── Color team status handler ─────────────────────────────────────────────

  const handleColorTeamChange = useCallback((sectionName: string, status: string) => {
    setColorTeamStatus((prev) => ({ ...prev, [sectionName]: status as ColorTeamStatus }))
  }, [])

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

  // ── Inline grammar handlers ───────────────────────────────────────────────

  const handleShowGrammarInDocument = useCallback((issues: GrammarIssue[]) => {
    setInlineGrammarIssues(issues)
    setDismissedGrammarTexts(new Set())
    setGrammarPopover(null)
    // Switch to the current section so the highlights are visible
    setActiveView(lastActiveSectionRef.current)
  }, [])

  const handleGrammarIssueClick = useCallback((payload: GrammarClickPayload) => {
    setGrammarPopover(payload)
  }, [])

  const handleGrammarAccept = useCallback((issue: GrammarIssue) => {
    const editor = editorRef.current?.editor
    setGrammarPopover(null)

    if (editor && issue.replacement !== undefined) {
      // Find and replace the first occurrence in the document
      const { state } = editor.view
      let found = false
      state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return
        const idx = node.text.toLowerCase().indexOf(issue.text.toLowerCase())
        if (idx === -1) return
        const from = pos + idx
        const to = from + issue.text.length
        const tr = state.tr.insertText(issue.replacement ?? '', from, to)
        editor.view.dispatch(tr)
        found = true
        isDirtyRef.current = true
      })
    } else if (editor) {
      // Scroll to the first occurrence
      const { state } = editor.view
      let targetPos: number | null = null
      state.doc.descendants((node, pos) => {
        if (targetPos !== null || !node.isText || !node.text) return
        const idx = node.text.toLowerCase().indexOf(issue.text.toLowerCase())
        if (idx !== -1) targetPos = pos + idx
      })
      if (targetPos !== null) {
        editor.commands.setTextSelection(targetPos)
        editor.commands.scrollIntoView()
        editor.commands.focus()
      }
    }

    // Dismiss after accept
    setDismissedGrammarTexts((prev) => new Set([...prev, grammarDismissKey(issue)]))
  }, [])

  const handleGrammarDismiss = useCallback((issue: GrammarIssue) => {
    setDismissedGrammarTexts((prev) => new Set([...prev, grammarDismissKey(issue)]))
    setGrammarPopover(null)
  }, [])

  // Clear grammar decorations when switching sections
  useEffect(() => {
    if (inlineGrammarIssues.length > 0) {
      setInlineGrammarIssues([])
      setDismissedGrammarTexts(new Set())
      setGrammarPopover(null)
    }
  // Only run on section change, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  // ── Generate preflight check ──────────────────────────────────────────────

  const handleGenerateWithPreflight = async (section: SectionName) => {
    if (isStreaming) return
    try {
      const res = await fetch(`/api/proposals/${proposalId}/preflight?section=${encodeURIComponent(section)}`)
      const { gaps } = await res.json() as { gaps: string[] }
      if (gaps && gaps.length > 0) {
        setPreflightGaps(gaps)
        setPendingSection(section)
        setShowPreflightModal(true)
        return
      }
    } catch {
      // Non-fatal — proceed to generate without preflight
    }
    handleGenerate(section)
  }

  // ── Generate (Quality Watchdog loop) ─────────────────────────────────────

  const handleGenerate = async (section: SectionName, instruction?: string, attachmentContext?: string) => {
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
        body: JSON.stringify({ section, instruction, attachment_context: attachmentContext }),
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
            const ctStatus = colorTeamStatus[section] ?? 'white'
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
                <span className="truncate flex-1">{section}</span>
                {/* Color team badge */}
                <ColorTeamBadge status={ctStatus} size="sm" />
              </button>
            )
          })}

          {/* TOOLS group */}
          <p className="px-3 pt-5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Tools
          </p>

          {(
            [
              { id: 'rfp-structure',   label: 'RFP Structure' },
              { id: 'compliance',      label: 'Compliance' },
              { id: 'scoring',         label: 'Scoring Rubric' },
              { id: 'grammar',         label: 'Grammar & Style' },
              { id: 'win-themes',      label: 'Win Themes' },
              { id: 'page-limits',     label: 'Page Limits' },
              { id: 'color-team',      label: 'Color Team' },
              { id: 'past-performance', label: 'Past Performance' },
              { id: 'custom-template',   label: 'Custom Template' },
              { id: 'writing-guidance', label: 'Writing Guidance' },
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

        {/* SECTION VIEW — editor left, score panel right */}
        {isSectionName(activeView) && (
          <>
            {/* Toolbar spans full width */}
            <div className="shrink-0">
              <EditorToolbar
                editor={editor ?? null}
                onSetView={(v) => setActiveView(v as ActiveView)}
                activeView={activeView}
              />
            </div>

            {/* Horizontal split: editor | score panel */}
            <div className="flex-1 flex overflow-hidden">

              {/* ── Left: editor canvas ── */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full px-10 py-8">
                  <SectionEditor
                    ref={editorRef}
                    content={currentSectionState?.content ?? null}
                    onUpdate={handleEditorUpdate}
                    isStreaming={isStreaming}
                    streamBuffer={streamBuffer}
                    grammarIssues={inlineGrammarIssues.length > 0 ? inlineGrammarIssues : undefined}
                    dismissedGrammarTexts={dismissedGrammarTexts}
                    onGrammarIssueClick={handleGrammarIssueClick}
                  />

                  {/* Empty state */}
                  {!hasContent && !isStreaming && (
                    <div className="border border-t-0 border-gray-200 bg-gray-50 px-6 py-4 rounded-b-md">
                      <p className="text-sm text-gray-500 font-medium">No draft yet</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Click Generate {activeSection} below to create an AI draft.
                      </p>
                    </div>
                  )}

                  {/* Quality Watchdog status bar */}
                  {isStreaming && watchdogStatus && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                      background: 'rgba(26,29,33,0.9)', borderRadius: 8,
                      border: `1px solid ${watchdogScore ? (watchdogScore.passed ? 'rgba(0,196,140,0.4)' : watchdogScore.score >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(255,77,79,0.4)') : 'rgba(192,194,198,0.15)'}`,
                      marginBottom: 8,
                    }}>
                      {watchdogScore && (
                        <div style={{
                          fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                          color: watchdogScore.passed ? '#00C48C' : watchdogScore.score >= 60 ? '#F59E0B' : '#FF4D4F',
                          lineHeight: 1, minWidth: 40, flexShrink: 0,
                        }}>
                          {watchdogScore.score}
                        </div>
                      )}
                      {!watchdogScore && (
                        <div style={{
                          fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                          color: 'rgba(192,194,198,0.35)', lineHeight: 1, minWidth: 40, flexShrink: 0,
                        }}>
                          …
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {watchdogStatus}
                      </div>
                    </div>
                  )}

                  {/* Generate / save bar */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-t-0 border-gray-200 rounded-b-md">
                    <div>
                      {saveStatus === 'saving' && (
                        <span className="flex items-center gap-1.5 text-xs text-blue-600">
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving...
                        </span>
                      )}
                      {saveStatus === 'saved' && currentSectionState?.lastSavedAt && (
                        <span className="text-xs text-gray-500">Saved at {currentSectionState.lastSavedAt}</span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-xs text-red-600">Save failed — check connection</span>
                      )}
                      {saveStatus === 'idle' && !currentSectionState?.lastSavedAt && (
                        <span className="text-xs text-gray-500">Not yet saved</span>
                      )}
                      {saveStatus === 'idle' && currentSectionState?.lastSavedAt && (
                        <span className="text-xs text-gray-500">Saved at {currentSectionState.lastSavedAt}</span>
                      )}
                      {isStreaming && !watchdogStatus && (
                        <span className="text-xs text-blue-600">Generating...</span>
                      )}
                    </div>
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
                          onClick={() => handleGenerateWithPreflight(activeSection)}
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

              {/* ── Right: score panel ── */}
              <div className="w-72 shrink-0 border-l border-gray-200 overflow-hidden flex flex-col bg-gray-50">
                <ScoringRubricPanel
                  proposalId={proposalId}
                  sectionName={activeSection}
                  plainText={allSectionsText[activeSection] ?? ''}
                  requirements={requirements}
                  complianceMatrix={complianceMatrix}
                  compact
                />
              </div>

            </div>
          </>
        )}

        {/* TOOL VIEWS */}
        {isToolView && (
          <>
            {activeView === 'rfp-structure' && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto w-full px-8 py-8">
                  <RfpStructureSidebar
                    rfpStructure={rfpStructure}
                    activeRfpSection={activeRfpSection}
                    onSectionClick={handleRfpSectionClick}
                  />
                </div>
              </div>
            )}

            {activeView === 'compliance' && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto w-full px-8 py-8">
                  <CompliancePanel
                    requirements={requirements}
                    coverage={currentCoverage}
                    sectionName={activeSection}
                  />
                </div>
              </div>
            )}

            {activeView === 'past-performance' && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto w-full px-8 py-8">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <PastPerformancePanel
                      proposalId={proposalId}
                      onInsertNarrative={handleInsertPpNarrative}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeView === 'scoring' && (
              <div className="flex-1 overflow-y-auto">
                <ScoringRubricPanel
                  proposalId={proposalId}
                  sectionName={activeSection}
                  plainText={allSectionsText[activeSection] ?? ''}
                  requirements={requirements}
                  complianceMatrix={complianceMatrix}
                />
              </div>
            )}

            {activeView === 'grammar' && (
              <div className="flex-1 overflow-y-auto">
                <GrammarPanel
                  plainText={allSectionsText[activeSection] ?? ''}
                  sectionName={activeSection}
                  onShowInDocument={handleShowGrammarInDocument}
                />
              </div>
            )}

            {activeView === 'win-themes' && (
              <div className="flex-1 overflow-y-auto">
                <WinThemesPanel
                  proposalId={proposalId}
                  allSectionsText={allSectionsText}
                />
              </div>
            )}

            {activeView === 'page-limits' && (
              <div className="flex-1 overflow-y-auto">
                <PageLimitsPanel
                  proposalId={proposalId}
                  allSectionsText={allSectionsText}
                />
              </div>
            )}

            {activeView === 'color-team' && (
              <div className="flex-1 overflow-y-auto">
                <ColorTeamPanel
                  proposalId={proposalId}
                  onStatusChange={handleColorTeamChange}
                />
              </div>
            )}

            {activeView === 'custom-template' && (
              <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Custom Template</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Upload your agency&apos;s solicitation template to follow their exact section structure instead of the standard sections.
                </p>
                <CustomTemplateUpload
                  proposalId={proposalId}
                  onSectionsExtracted={(extractedSections) => {
                    toast.success(`${extractedSections.length} sections extracted from template`)
                  }}
                />
              </div>
            )}

            {activeView === 'writing-guidance' && (
              <div className="flex-1 overflow-hidden">
                <WritingGuidancePanel
                  sectionName={activeSection}
                  sectionText={allSectionsText[activeSection] ?? ''}
                  requirements={requirements}
                />
              </div>
            )}
          </>
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

      {/* Inline grammar popover */}
      {grammarPopover && (
        <GrammarPopover
          issue={grammarPopover.issue}
          screenX={grammarPopover.screenX}
          screenY={grammarPopover.screenY}
          onAccept={handleGrammarAccept}
          onDismiss={handleGrammarDismiss}
          onClose={() => setGrammarPopover(null)}
        />
      )}

      {/* Preflight modal — collects missing data before generation */}
      {showPreflightModal && pendingSection && (
        <SectionPreflightModal
          isOpen={showPreflightModal}
          sectionName={pendingSection}
          gaps={preflightGaps as ('past_projects' | 'key_personnel' | 'capability_statement')[]}
          onConfirm={(attachmentContext) => {
            setShowPreflightModal(false)
            const section = pendingSection
            setPendingSection(null)
            setPreflightGaps([])
            handleGenerate(section, undefined, attachmentContext)
          }}
          onSkip={() => {
            setShowPreflightModal(false)
            const section = pendingSection
            setPendingSection(null)
            setPreflightGaps([])
            handleGenerate(section)
          }}
          onCancel={() => {
            setShowPreflightModal(false)
            setPendingSection(null)
            setPreflightGaps([])
          }}
        />
      )}
    </div>
  )
}
