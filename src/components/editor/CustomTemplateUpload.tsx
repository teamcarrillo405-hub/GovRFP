'use client'

import { useRef, useState, useCallback } from 'react'
import type { CustomTemplateSection } from '@/lib/editor/types'

interface Props {
  proposalId: string
  onSectionsExtracted: (sections: CustomTemplateSection[]) => void
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function CustomTemplateUpload({ proposalId, onSectionsExtracted }: Props) {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [extractedCount, setExtractedCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setUploadState('uploading')
      setErrorMessage('')
      setExtractedCount(0)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/proposals/${proposalId}/template`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Upload failed (${res.status})`)
        }

        const data = await res.json() as { sections: CustomTemplateSection[] }
        setExtractedCount(data.sections.length)
        setUploadState('success')
        onSectionsExtracted(data.sections)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
        setUploadState('error')
      }
    },
    [proposalId, onSectionsExtracted]
  )

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const onDragLeave = () => setIsDragOver(false)

  const triggerFileInput = () => fileInputRef.current?.click()

  return (
    <div className="font-sans">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={onFileInputChange}
        aria-label="Upload solicitation template file"
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={uploadState !== 'uploading' ? triggerFileInput : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && uploadState !== 'uploading') {
            triggerFileInput()
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        aria-disabled={uploadState === 'uploading'}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors',
          uploadState !== 'uploading' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          isDragOver
            ? 'border-yellow-400 bg-yellow-50'
            : 'border-black bg-white hover:border-yellow-400 hover:bg-yellow-50',
        ].join(' ')}
      >
        {/* Upload icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-black"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <div>
          <p className="text-sm font-semibold text-black">Upload Solicitation Template</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Upload the agency&apos;s template to follow their exact section structure
          </p>
          <p className="mt-1 text-xs text-gray-400">PDF, DOCX, or TXT — drag &amp; drop or click</p>
        </div>
      </div>

      {/* Status messages */}
      {uploadState === 'uploading' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          {/* Spinner */}
          <svg
            className="h-4 w-4 animate-spin text-black"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Extracting sections&hellip;</span>
        </div>
      )}

      {uploadState === 'success' && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-black">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>
            <strong>{extractedCount}</strong> section{extractedCount !== 1 ? 's' : ''} extracted successfully
          </span>
        </div>
      )}

      {uploadState === 'error' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Retry button after error */}
      {uploadState === 'error' && (
        <button
          type="button"
          onClick={triggerFileInput}
          className="mt-2 text-xs font-medium text-black underline underline-offset-2 hover:text-yellow-600"
        >
          Try again
        </button>
      )}
    </div>
  )
}
