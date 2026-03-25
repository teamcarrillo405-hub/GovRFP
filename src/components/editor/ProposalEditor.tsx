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
}

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

export default function ProposalEditor({
  proposalId,
  initialSections,
  requirements,
  complianceMatrix,
  rfpStructure,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionName>('Executive Summary')
  const [sections, setSections] = useState<Map<SectionName, SectionState>>(
    () => initSectionsMap(initialSections)
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
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
  const activeSectionRef = useRef<SectionName>(activeSection)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep refs in sync
  useEffect(() => {
    activeSectionRef.current = activeSection
  }, [activeSection])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  // Save current section to Supabase
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

  // Set up 30-second auto-save interval
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (!isDirtyRef.current || isSavingRef.current || isStreamingRef.current) return
      saveCurrentSection(activeSectionRef.current, 'edited')
    }, 30_000)

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    }
  }, [saveCurrentSection])

  // Handle section tab switch — save current before switching
  const handleTabSwitch = async (section: SectionName) => {
    if (isStreaming) return
    if (section === activeSection) return

    // Save current section if dirty
    if (isDirtyRef.current) {
      await saveCurrentSection(activeSection, 'edited')
    }
    setActiveSection(section)
    isDirtyRef.current = false
  }

  // Handle editor content updates
  const handleEditorUpdate = useCallback((json: JSONContent) => {
    isDirtyRef.current = true
    setSections((prev) => {
      const next = new Map(prev)
      const existing = next.get(activeSectionRef.current)
      if (existing) {
        next.set(activeSectionRef.current, { ...existing, content: json })
      }
      return next
    })
  }, [])

  // Click-to-scroll: find matching heading in editor and scroll to it
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

  // Detect which RFP section the cursor is currently in
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

  // Wire active section detection to editor events
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

  // Run detection once after mount (editor ref may not be available on first render)
  useEffect(() => {
    const timer = setTimeout(() => detectActiveRfpSection(), 500)
    return () => clearTimeout(timer)
  }, [detectActiveRfpSection, activeSection])

  // Handle generate/stream
  const handleGenerate = async (section: SectionName, instruction?: string) => {
    if (isStreaming) return

    setIsStreaming(true)
    isStreamingRef.current = true
    setStreamBuffer('')

    try {
      const res = await fetch(`/api/proposals/${proposalId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, instruction }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Generation failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE lines
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              // Handle Anthropic SSE event types
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                fullText += parsed.delta.text
                setStreamBuffer(fullText)
              }
            } catch {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      }

      // Buffer pattern: write to editor ONCE on completion (not per chunk)
      const editor = editorRef.current?.editor
      if (editor && fullText) {
        // Strip markdown code fences if Claude wrapped the output
        let html = fullText.trim()
        const fenceMatch = html.match(/^```(?:html)?\s*([\s\S]*?)```\s*$/)
        if (fenceMatch) {
          html = fenceMatch[1].trim()
        }
        // If it doesn't look like HTML, convert plain text to paragraphs
        if (!html.startsWith('<')) {
          html = html
            .split(/\n\n+/)
            .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join('')
        }
        editor.commands.setContent(html)
        isDirtyRef.current = true
      }

      // Mark section as draft and save
      setSections((prev) => {
        const next = new Map(prev)
        const existing = next.get(section) ?? { content: null, draftStatus: 'empty', lastSavedAt: null }
        next.set(section, { ...existing, draftStatus: 'draft' })
        return next
      })

      // Auto-save immediately after generation
      await saveCurrentSection(section, 'draft')
    } catch (err) {
      console.error('Generation error:', err)
      setSaveStatus('error')
    } finally {
      setIsStreaming(false)
      isStreamingRef.current = false
      setStreamBuffer('')
    }
  }

  const currentSectionState = sections.get(activeSection)
  const hasContent =
    currentSectionState?.draftStatus !== 'empty' &&
    currentSectionState?.content !== null

  const currentCoverage = complianceCoverage.get(activeSection) ?? new Map()

  const editor = editorRef.current?.editor

  return (
    <div className="flex gap-0">
      <RfpStructureSidebar
        rfpStructure={rfpStructure}
        activeRfpSection={activeRfpSection}
        onSectionClick={handleRfpSectionClick}
      />

      {/* Editor column */}
      <div className="flex-1 min-w-0">
        {/* Section tabs */}
        <div
          className={[
            'flex gap-0 border-b border-gray-200 overflow-x-auto scrollbar-none',
            isStreaming ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
          role="tablist"
          aria-label="Proposal sections"
        >
          {SECTION_NAMES.map((section) => (
            <button
              key={section}
              role="tab"
              aria-selected={section === activeSection}
              onClick={() => handleTabSwitch(section)}
              className={[
                'px-3 py-2 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap',
                section === activeSection
                  ? 'border-b-2 border-blue-700 text-blue-700 bg-white'
                  : 'text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100',
              ].join(' ')}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <EditorToolbar editor={editor ?? null} />

        {/* Tiptap canvas */}
        <SectionEditor
          ref={editorRef}
          content={currentSectionState?.content ?? null}
          onUpdate={handleEditorUpdate}
          isStreaming={isStreaming}
          streamBuffer={streamBuffer}
        />

        {/* Empty state */}
        {!hasContent && !isStreaming && (
          <div className="border border-t-0 border-gray-200 bg-gray-50 px-6 py-4">
            <p className="text-sm text-gray-500 font-medium">No draft yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Click Generate {activeSection} to create an AI draft based on your contractor profile and RFP
              requirements.
            </p>
          </div>
        )}

        {/* Generate bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-t-0 border-gray-200 rounded-b-md">
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && currentSectionState?.lastSavedAt && (
              <span className="text-xs text-gray-400">Saved at {currentSectionState.lastSavedAt}</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-600">Save failed — check connection</span>
            )}
            {saveStatus === 'idle' && !currentSectionState?.lastSavedAt && (
              <span className="text-xs text-gray-400">Not yet saved</span>
            )}
            {saveStatus === 'idle' && currentSectionState?.lastSavedAt && (
              <span className="text-xs text-gray-400">Saved at {currentSectionState.lastSavedAt}</span>
            )}
            {isStreaming && (
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

      {/* Compliance panel */}
      <CompliancePanel
        requirements={requirements}
        coverage={currentCoverage}
        sectionName={activeSection}
      />

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
