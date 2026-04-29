'use client'

import { useEffect, useRef } from 'react'
import type { GrammarIssue } from '@/lib/editor/grammar-analyzer'

const TYPE_LABEL: Record<GrammarIssue['type'], string> = {
  'passive-voice': 'Passive Voice',
  'weak-word': 'Weak Word',
  'jargon': 'Jargon',
  'long-sentence': 'Long Sentence',
  'repeated-word': 'Repeated Word',
  'grammar': 'Grammar',
}

const TYPE_COLOR: Record<GrammarIssue['type'], string> = {
  'passive-voice': '#F97316',
  'weak-word': '#3B82F6',
  'jargon': '#8B5CF6',
  'long-sentence': '#EAB308',
  'repeated-word': '#6B7280',
  'grammar': '#EF4444',
}

interface Props {
  issue: GrammarIssue
  screenX: number
  screenY: number
  onAccept: (issue: GrammarIssue) => void
  onDismiss: (issue: GrammarIssue) => void
  onClose: () => void
}

export default function GrammarPopover({ issue, screenX, screenY, onAccept, onDismiss, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Clamp to viewport
  const popoverWidth = 280
  const left = Math.min(screenX, window.innerWidth - popoverWidth - 12)
  const top = screenY + window.scrollY

  const hasReplacement = issue.replacement !== undefined
  const acceptLabel = hasReplacement
    ? issue.replacement === ''
      ? 'Remove word'
      : `Replace with "${issue.replacement}"`
    : 'Go to issue'

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top: top - window.scrollY,
        width: popoverWidth,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        padding: '12px 14px',
        fontSize: 13,
      }}
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            background: TYPE_COLOR[issue.type] + '22',
            color: TYPE_COLOR[issue.type],
            borderRadius: 99,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {TYPE_LABEL[issue.type]}
        </span>
        <span style={{ fontWeight: 600, color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          &ldquo;{issue.text}&rdquo;
        </span>
      </div>

      {/* Suggestion */}
      <p style={{ color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
        {issue.suggestion}
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onAccept(issue)}
          style={{
            flex: 1,
            padding: '5px 10px',
            background: '#2F80FF',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {acceptLabel}
        </button>
        <button
          onClick={() => onDismiss(issue)}
          style={{
            padding: '5px 10px',
            background: '#F1F5F9',
            color: '#475569',
            border: '1px solid #CBD5E1',
            borderRadius: 5,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
