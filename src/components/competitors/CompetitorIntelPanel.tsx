'use client'

import { useEffect, useState } from 'react'
import type { Competitor } from '@/app/api/competitors/route'

interface Props {
  naics: string | null
  agency?: string | null
  opportunityId: string
}

export function CompetitorIntelPanel({ naics, agency, opportunityId: _opportunityId }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'empty'>('idle')

  useEffect(() => {
    if (!naics) { setStatus('empty'); return }
    setStatus('loading')
    const params = new URLSearchParams()
    params.set('naics', naics)
    if (agency) params.set('agency', agency)

    fetch(`/api/competitors?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('upstream')
        const json = (await res.json()) as { competitors: Competitor[] }
        if (json.competitors.length === 0) setStatus('empty')
        else { setCompetitors(json.competitors); setStatus('done') }
      })
      .catch(() => setStatus('error'))
  }, [naics, agency])

  const topValue = competitors.length > 0 ? competitors[0].total_value_millions : 1

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl mt-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ShieldIcon />
          <h2 className="text-base font-bold text-gray-100">Incumbent Competitors</h2>
        </div>
        <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
          Powered by USASpending.gov
        </span>
      </div>

      <div className="px-5 py-4">
        {status === 'loading' && (
          <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
        )}
        {status === 'done' && (
          <ul className="space-y-4">
            {competitors.map((c) => (
              <CompetitorCard key={c.uei ?? c.name} competitor={c} topValue={topValue} />
            ))}
          </ul>
        )}
        {status === 'empty' && (
          <p className="text-sm text-gray-400 py-2">No competitors found in USASpending for this NAICS code.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400 py-2">USASpending data temporarily unavailable. Please try again in a moment.</p>
        )}
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-gray-500">Based on federal contract awards 2021–2025.</p>
      </div>
    </div>
  )
}

function CompetitorCard({ competitor: c, topValue }: { competitor: Competitor; topValue: number }) {
  const barWidth = topValue > 0 ? (c.total_value_millions / topValue) * 100 : 0
  const latestAwardFormatted = c.latest_award
    ? new Date(c.latest_award).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-100 truncate">{c.name}</p>
          {c.uei && <p className="text-xs text-gray-500 mt-0.5">UEI: {c.uei}</p>}
        </div>
        <div className="text-right shrink-0 tabular-nums">
          <p className="text-sm font-bold text-red-400">${c.total_value_millions.toFixed(1)}M</p>
          <p className="text-xs text-gray-500">{c.total_contracts} contract{c.total_contracts !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {c.agencies.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.agencies.map((ag) => (
            <span key={ag} className="text-xs bg-blue-950/50 text-blue-300 px-2 py-0.5 rounded-md truncate max-w-[200px]">{ag}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {c.states.map((st) => (
          <span key={st} className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-md">{st}</span>
        ))}
        {c.naics_codes.slice(0, 3).map((n) => (
          <span key={n} className="text-xs bg-yellow-950/40 text-yellow-400 px-2 py-0.5 rounded-md">{n}</span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {latestAwardFormatted
          ? <p className="text-xs text-gray-500">Last award: {latestAwardFormatted}</p>
          : <span />}
        <a href={c.sam_url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-red-400 hover:underline shrink-0">
          View on SAM.gov &rarr;
        </a>
      </div>

      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-lg border border-white/10 bg-white/5 px-4 py-3 space-y-2">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/5" />
          <div className="h-3 bg-white/10 rounded w-1/4" />
        </div>
        <div className="space-y-1">
          <div className="h-4 bg-white/10 rounded w-16" />
          <div className="h-3 bg-white/10 rounded w-12" />
        </div>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full w-full" />
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
