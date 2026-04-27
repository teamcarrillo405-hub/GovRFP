'use client'

import { useState, useTransition } from 'react'
import { createProposalFromOpportunity } from '@/app/(dashboard)/proposals/new/actions'

interface Props {
  opportunity: Record<string, unknown>
}

export function OpportunityProposalPanel({ opportunity }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const agency = (opportunity.agency ?? opportunity.agency_name ?? 'Unknown Agency') as string
  const setAside = (opportunity.set_aside ?? opportunity.set_aside_description ?? null) as string | null
  const deadline = (opportunity.due_date ?? opportunity.response_deadline ?? null) as string | null
  const state = (opportunity.place_of_performance_state ?? opportunity.pop_state ?? null) as string | null
  const samUrl = (opportunity.sam_url ?? opportunity.ui_link ?? null) as string | null

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const onCreate = () => {
    setError(null)
    startTransition(async () => {
      try {
        await createProposalFromOpportunity(opportunity.id as string)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create proposal')
      }
    })
  }

  return (
    <div>
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 bg-[#F0F6FF] border-b border-gray-200 flex items-center gap-2">
          <span className="inline-block w-5 h-5 rounded-full bg-[#2F80FF] text-white text-xs font-bold flex items-center justify-center">✓</span>
          <span className="text-sm font-semibold text-gray-900">Pre-filled from SAM.gov</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Opportunity Title</div>
            <div className="text-sm font-semibold text-gray-900">{opportunity.title as string}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Agency</div>
              <div className="text-sm text-gray-900">{agency}</div>
            </div>
            {opportunity.solicitation_number && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Solicitation #</div>
                <div className="text-sm text-gray-900">{opportunity.solicitation_number as string}</div>
              </div>
            )}
            {opportunity.naics_code && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">NAICS</div>
                <div className="text-sm text-gray-900">{opportunity.naics_code as string}</div>
              </div>
            )}
            {setAside && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Set-Aside</div>
                <div className="text-sm text-gray-900">{setAside}</div>
              </div>
            )}
            {deadline && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Response Deadline</div>
                <div className="text-sm text-gray-900">{fmtDate(deadline)}</div>
              </div>
            )}
            {state && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Place of Performance</div>
                <div className="text-sm text-gray-900">{state}</div>
              </div>
            )}
          </div>
          {samUrl && (
            <div className="pt-1">
              <a
                href={samUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#2F80FF] font-medium hover:underline"
              >
                View on SAM.gov and download RFP documents →
              </a>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      <button
        onClick={onCreate}
        disabled={isPending}
        className="w-full py-3 px-6 bg-[#2F80FF] hover:bg-[#2568CC] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {isPending ? 'Creating proposal...' : 'Create Proposal Draft'}
      </button>
      <p className="text-xs text-gray-400 mt-3 text-center">
        The proposal will be created using the SAM.gov metadata above. Upload the RFP PDF from SAM.gov afterward for full AI analysis.
      </p>
    </div>
  )
}
