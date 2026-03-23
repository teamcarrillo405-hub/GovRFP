'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProcessingStatusProps {
  proposalId: string
  initialStatus: string
  initialError?: string | null
}

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Queued', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  processing: { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  completed: { label: 'Ready', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
}

export default function ProcessingStatus({
  proposalId,
  initialStatus,
  initialError,
}: ProcessingStatusProps) {
  const [status, setStatus] = useState<JobStatus>(initialStatus as JobStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError ?? null)

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to Realtime Postgres Changes on document_jobs filtered by proposal_id
    const channel = supabase
      .channel(`job-status-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'document_jobs',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: JobStatus; error_message?: string }).status
          setStatus(newStatus)
          if (newStatus === 'failed') {
            setErrorMessage((payload.new as { error_message?: string }).error_message || 'Processing failed')
          }
          if (newStatus === 'completed') {
            // Reload page so the server component can show rfp_text/rfp_structure
            window.location.reload()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [proposalId])

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor}`}>
      <div className="flex items-center gap-3">
        {/* Status indicator icon */}
        {(status === 'pending' || status === 'processing') && (
          <svg className="h-5 w-5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status === 'completed' && (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {status === 'failed' && (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}

        <div>
          <p className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </p>
          {status === 'processing' && (
            <p className="text-xs text-gray-500 mt-0.5">
              Extracting text from your RFP document...
            </p>
          )}
          {status === 'pending' && (
            <p className="text-xs text-gray-500 mt-0.5">
              Your document is queued for processing
            </p>
          )}
        </div>
      </div>

      {/* Error details */}
      {status === 'failed' && errorMessage && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <a
            href="/proposals/new"
            className="mt-2 inline-block text-sm text-red-700 underline hover:text-red-900"
          >
            Upload again
          </a>
        </div>
      )}
    </div>
  )
}
