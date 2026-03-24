'use client'
import { useState, useEffect } from 'react'

interface Props {
  proposalId: string
}

export default function ExportButtons({ proposalId }: Props) {
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clear error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  async function downloadFile(format: 'docx' | 'pdf') {
    const setter = format === 'docx' ? setDownloadingDocx : setDownloadingPdf
    setter(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/export/${format}`, { method: 'POST' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposal.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed — try again')
    } finally {
      setter(false)
    }
  }

  // Inline SVG spinner (16x16, animate-spin)
  const spinner = (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )

  // Document download icon (16x16 inline SVG)
  const docIcon = (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <path d="M8 8v4M6 10l2 2 2-2" />
    </svg>
  )

  // PDF icon (16x16 inline SVG)
  const pdfIcon = (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <path d="M5 10h6M5 12h4" />
    </svg>
  )

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={downloadingDocx}
          onClick={() => downloadFile('docx')}
          aria-busy={downloadingDocx}
          aria-label="Export proposal as Word document"
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloadingDocx ? spinner : docIcon}
          {downloadingDocx ? 'Exporting...' : 'Export Word'}
        </button>
        <button
          type="button"
          disabled={downloadingPdf}
          onClick={() => downloadFile('pdf')}
          aria-busy={downloadingPdf}
          aria-label="Export proposal as PDF"
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloadingPdf ? spinner : pdfIcon}
          {downloadingPdf ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>
      {error && (
        <span className="text-xs text-red-600 mt-1 block" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
