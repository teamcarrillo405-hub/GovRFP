'use client'

import { useEffect, useRef } from 'react'
import type { SectionName } from '@/lib/editor/types'

interface Props {
  isOpen: boolean
  sectionName: SectionName
  onConfirm: (instruction?: string) => void
  onCancel: () => void
}

export default function RegenerateDialog({ isOpen, sectionName, onConfirm, onCancel }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const handleConfirm = () => {
    const instruction = textareaRef.current?.value.trim()
    onConfirm(instruction || undefined)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the overlay itself, not the panel
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="regenerate-dialog-title"
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3
          id="regenerate-dialog-title"
          className="text-base font-semibold text-gray-900 mb-4"
        >
          Regenerate {sectionName}
        </h3>

        <label htmlFor="regenerate-instructions" className="block text-sm text-gray-700 mb-2">
          Instructions{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="regenerate-instructions"
          ref={textareaRef}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional: Add specific instructions (e.g., focus more on cybersecurity certifications)"
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors"
          >
            Generate New Draft
          </button>
        </div>
      </div>
    </div>
  )
}
