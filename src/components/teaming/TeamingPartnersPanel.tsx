'use client'

import { useEffect, useState } from 'react'
import type { TeamingPartner } from '@/app/api/teaming/route'

interface Props {
  naics: string | null
  state: string | null
  opportunityId: string
}

export function TeamingPartnersPanel({ naics, state, opportunityId: _opportunityId }: Props) {
  const [partners, setPartners] = useState<TeamingPartner[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'empty'>('idle')

  useEffect(() => {
    if (!naics) { setStatus('empty'); return }
    setStatus('loading')
    const params = new URLSearchParams()
    params.set('naics', naics)
    if (state) params.set('state', state)

    fetch(`/api/teaming?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('upstream')
        const json = (await res.json()) as { partners: TeamingPartner[] }
        if (json.partners.length === 0) setStatus('empty')
        else { setPartners(json.partners); setStatus('done') }
      })
      .catch(() => setStatus('error'))
  }, [naics, state])

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl mt-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <HandshakeIcon />
          <h2 className="text-base font-bold text-gray-100">Find Teaming Partners</h2>
        </div>
        <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">Powered by USASpending.gov</span>
      </div>

      <div className="px-5 py-4">
        {status === 'loading' && (
          <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
        )}
        {status === 'done' && (
          <ul className="space-y-3">
            {partners.map((p) => <PartnerCard key={p.uei ?? p.name} partner={p} />)}
          </ul>
        )}
        {status === 'empty' && (
          <p className="text-sm text-gray-400 py-2">No teaming partners found in USASpending for this NAICS + region.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400 py-2">USASpending data temporarily unavailable. Please try again in a moment.</p>
        )}
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-gray-500">Based on federal contract awards 2022–2025. Does not guarantee availability.</p>
      </div>
    </div>
  )
}

function PartnerCard({ partner }: { partner: TeamingPartner }) {
  const scoreColor =
    partner.compatibility_score >= 80 ? 'bg-green-950/50 text-green-400'
    : partner.compatibility_score >= 50 ? 'bg-yellow-950/50 text-yellow-400'
    : 'bg-white/10 text-gray-400'

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-100 truncate">{partner.name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {partner.state && (
            <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-md">{partner.state}</span>
          )}
          {partner.naics_codes.slice(0, 3).map((n) => (
            <span key={n} className="text-xs bg-blue-950/50 text-blue-300 px-2 py-0.5 rounded-md">{n}</span>
          ))}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-red-400 tabular-nums">
          ${partner.total_value_millions.toFixed(1)}M in contracts
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({partner.total_contracts} award{partner.total_contracts !== 1 ? 's' : ''})
          </span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${scoreColor}`}>
          {partner.compatibility_score}% match
        </span>
        <a href={`https://sam.gov/search/?keywords=${encodeURIComponent(partner.name)}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-red-400 hover:underline">
          View on SAM.gov →
        </a>
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/5" />
        <div className="h-3 bg-white/10 rounded w-2/5" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
      </div>
      <div className="flex flex-col gap-2 items-end">
        <div className="h-5 bg-white/10 rounded-full w-16" />
        <div className="h-3 bg-white/10 rounded w-20" />
      </div>
    </div>
  )
}

function HandshakeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  )
}
