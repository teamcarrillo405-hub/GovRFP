'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
} as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

type FileType = 'pdf' | 'docx'

interface UploadState {
  status: 'idle' | 'validating' | 'uploading' | 'error'
  progress: number // 0-100
  error: string | null
}

export default function FileUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
  })
  const [dragActive, setDragActive] = useState(false)

  const validateFile = (file: File): { valid: boolean; fileType?: FileType; error?: string } => {
    const fileType = ACCEPTED_TYPES[file.type as keyof typeof ACCEPTED_TYPES]
    if (!fileType) {
      // Also check extension as fallback
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') return { valid: true, fileType: 'pdf' }
      if (ext === 'docx') return { valid: true, fileType: 'docx' }
      return { valid: false, error: 'Only PDF and Word (.docx) files are supported' }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 50MB limit` }
    }
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' }
    }
    return { valid: true, fileType }
  }

  const handleUpload = useCallback(async (file: File) => {
    setState({ status: 'validating', progress: 0, error: null })

    const validation = validateFile(file)
    if (!validation.valid || !validation.fileType) {
      setState({ status: 'error', progress: 0, error: validation.error || 'Invalid file' })
      return
    }

    try {
      // Step 1: Get signed upload URL from our API
      setState({ status: 'uploading', progress: 10, error: null })

      const res = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: validation.fileType,
          fileSize: file.size,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error((data as { error?: string }).error || 'Failed to get upload URL')
      }

      const { signedUrl, token, proposalId } = await res.json() as {
        signedUrl: string
        token: string
        proposalId: string
      }

      // Step 2: Upload file directly to Supabase Storage via signed URL
      setState(prev => ({ ...prev, progress: 30 }))

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(token ? { 'x-upsert': 'true' } : {}),
        },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage')
      }

      setState(prev => ({ ...prev, progress: 100 }))

      // Step 3: Navigate to proposal detail page (shows processing status)
      router.push(`/proposals/${proposalId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setState({ status: 'error', progress: 0, error: message })
      toast.error('Upload failed', { description: message + ' — check the file and try again.' })
    }
  }, [router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragActive(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const isUploading = state.status === 'uploading' || state.status === 'validating'

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>

        <p className="text-sm font-medium text-gray-900 mb-1">
          {dragActive ? 'Drop your file here' : 'Drag and drop your RFP file'}
        </p>
        <p className="text-xs text-gray-500">
          PDF or Word (.docx) up to 50MB
        </p>

        {!isUploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            Browse files
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">
              {state.status === 'validating' ? 'Preparing upload...' : 'Uploading...'}
            </span>
            <span className="text-sm text-gray-500">{state.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {state.status === 'error' && state.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{state.error}</p>
          <button
            onClick={() => setState({ status: 'idle', progress: 0, error: null })}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
