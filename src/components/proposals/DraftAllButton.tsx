'use client'

import { useState, useCallback } from 'react'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'

interface Props {
  proposalId: string
}

type SectionStatus = 'waiting' | 'generating' | 'done' | 'skipped' | 'error'

interface SectionState {
  name: SectionName
  status: SectionStatus
  wordCount?: number
  skipReason?: string
}

function initSections(): SectionState[] {
  return SECTION_NAMES.map((name) => ({ name, status: 'waiting' }))
}

export default function DraftAllButton({ proposalId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [sections, setSections] = useState<SectionState[]>(initSections)
  const [completedCount, setCompletedCount] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const total = SECTION_NAMES.length

  const resetState = useCallback(() => {
    setSections(initSections())
    setCompletedCount(0)
    setIsDone(false)
    setErrorMsg(null)
  }, [])

  const handleOpen = useCallback(() => {
    resetState()
    setIsOpen(true)
    setIsRunning(true)

    const url = `/api/proposals/${proposalId}/draft-all`
    const es = new EventSource(url)

    es.addEventListener('section_start', (e) => {
      const data = JSON.parse(e.data) as { section: SectionName; index: number }
      setSections((prev) =>
        prev.map((s) =>
          s.name === data.section ? { ...s, status: 'generating' } : s
        )
      )
    })

    es.addEventListener('section_complete', (e) => {
      const data = JSON.parse(e.data) as {
        section: SectionName
        index: number
        wordCount: number
      }
      setSections((prev) =>
        prev.map((s) =>
          s.name === data.section
            ? { ...s, status: 'done', wordCount: data.wordCount }
            : s
        )
      )
      setCompletedCount((c) => c + 1)
    })

    es.addEventListener('section_skip', (e) => {
      const data = JSON.parse(e.data) as {
        section: SectionName
        reason: string
      }
      setSections((prev) =>
        prev.map((s) =>
          s.name === data.section
            ? { ...s, status: 'skipped', skipReason: data.reason }
            : s
        )
      )
      setCompletedCount((c) => c + 1)
    })

    es.addEventListener('done', () => {
      setIsDone(true)
      setIsRunning(false)
      es.close()
    })

    es.addEventListener('error', (e) => {
      if ((e as MessageEvent).data) {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { message: string }
          setErrorMsg(data.message)
        } catch {
          setErrorMsg('An unexpected error occurred.')
        }
      } else {
        // EventSource connection error (not a data error)
        if (!isDone) {
          setErrorMsg('Connection to server lost. Please try again.')
        }
      }
      setIsRunning(false)
      es.close()
    })
  }, [proposalId, resetState, isDone])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  // --- Status icon renderer (no emojis, pure text/CSS) ---
  function StatusIcon({ status }: { status: SectionStatus }) {
    if (status === 'waiting') {
      return (
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#4B5563',
            flexShrink: 0,
          }}
        />
      )
    }
    if (status === 'generating') {
      return (
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#F59E0B',
            flexShrink: 0,
            animation: 'draftAllPulse 1s ease-in-out infinite',
          }}
        />
      )
    }
    if (status === 'done') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#10B981',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          &#10003;
        </span>
      )
    }
    if (status === 'skipped') {
      return (
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 2,
            background: '#6B7280',
            borderRadius: 1,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />
      )
    }
    // error
    return (
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#EF4444',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes draftAllPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      {/* Trigger button */}
      <button
        onClick={handleOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          background: '#FF1A1A',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'Oxanium, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1,
          height: 28,
          whiteSpace: 'nowrap',
        }}
      >
        Draft All Sections
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Glass panel */}
          <div
            style={{
              background: 'rgba(26,29,33,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(192,194,198,0.15)',
              borderRadius: 16,
              padding: '28px 32px',
              width: 440,
              maxWidth: '90vw',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94A3B8',
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
              }}
              aria-label="Close"
            >
              &#x2715;
            </button>

            {/* Header */}
            <div
              style={{
                fontFamily: 'Oxanium, sans-serif',
                fontSize: 18,
                fontWeight: 700,
                color: '#F5F5F7',
                marginBottom: 20,
                letterSpacing: '-0.01em',
              }}
            >
              Generating All Sections
            </div>

            {/* Progress count */}
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                color: '#94A3B8',
                marginBottom: 16,
              }}
            >
              {completedCount} / {total} sections complete
            </div>

            {/* Section list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sections.map((sec) => (
                <div
                  key={sec.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <StatusIcon status={sec.status} />
                  <span
                    style={{
                      fontFamily: 'Oxanium, sans-serif',
                      fontSize: 13,
                      fontWeight: sec.status === 'generating' ? 600 : 400,
                      color:
                        sec.status === 'done'
                          ? '#F5F5F7'
                          : sec.status === 'generating'
                          ? '#F59E0B'
                          : sec.status === 'skipped'
                          ? '#6B7280'
                          : '#C0C2C6',
                      flex: 1,
                    }}
                  >
                    {sec.name}
                  </span>
                  {sec.status === 'done' && sec.wordCount !== undefined && (
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 10,
                        color: '#4B5563',
                      }}
                    >
                      {sec.wordCount}w
                    </span>
                  )}
                  {sec.status === 'skipped' && (
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 10,
                        color: '#4B5563',
                      }}
                    >
                      skipped
                    </span>
                  )}
                  {sec.status === 'generating' && (
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 10,
                        color: '#F59E0B',
                      }}
                    >
                      generating...
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div
                style={{
                  marginTop: 20,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  color: '#FCA5A5',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Done state */}
            {isDone && !errorMsg && (
              <div
                style={{
                  marginTop: 20,
                  padding: '12px 16px',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Oxanium, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#6EE7B7',
                    marginBottom: 6,
                  }}
                >
                  Complete! Refresh the editor to see all sections.
                </div>
                <a
                  href={`/proposals/${proposalId}/editor`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: '#34D399',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Go to editor
                </a>
              </div>
            )}

            {/* Running indicator */}
            {isRunning && (
              <div
                style={{
                  marginTop: 16,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  color: '#4B5563',
                }}
              >
                This may take up to 2 minutes. Do not close this window.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
