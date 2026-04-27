'use client'

import { useState, useTransition } from 'react'
import { createProposalFromOpportunity } from '@/app/(dashboard)/proposals/new/actions'

type Opp = {
  id: string
  title?: string
  agency?: string
  agency_name?: string
  solicitation_number?: string
  naics_code?: string
  set_aside?: string
  set_aside_description?: string
  due_date?: string
  response_deadline?: string
  place_of_performance_state?: string
  pop_state?: string
  sam_url?: string
  ui_link?: string
}

interface Props {
  opportunity: Record<string, unknown>
}

export function OpportunityProposalPanel({ opportunity: raw }: Props) {
  const opp = raw as Opp
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const agency = opp.agency ?? opp.agency_name ?? 'Unknown Agency'
  const setAside = opp.set_aside ?? opp.set_aside_description ?? null
  const deadline = opp.due_date ?? opp.response_deadline ?? null
  const state = opp.place_of_performance_state ?? opp.pop_state ?? null
  const samUrl = opp.sam_url ?? opp.ui_link ?? null

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const onCreate = () => {
    setError(null)
    startTransition(async () => {
      try {
        await createProposalFromOpportunity(opp.id)
      } catch (e: unknown) {
        // Next.js redirect() throws internally — let it propagate
        if (e && typeof e === 'object' && 'digest' in e) throw e
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
            <div className="text-sm font-semibold text-gray-900">{opp.title ?? ''}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Agency</div>
              <div className="text-sm text-gray-900">{agency}</div>
            </div>
            {opp.solicitation_number && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Solicitation #</div>
                <div className="text-sm text-gray-900">{opp.solicitation_number}</div>
              </div>
            )}
            {opp.naics_code && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">NAICS</div>
                <div className="text-sm text-gray-900">{opp.naics_code}</div>
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
