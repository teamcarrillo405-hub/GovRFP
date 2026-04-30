'use client'

import { useState } from 'react'
import { CompetitorIntelPanel } from '@/components/competitors/CompetitorIntelPanel'

export default function CompetitorsPage() {
  const [naics, setNaics] = useState('')
  const [agency, setAgency] = useState('')
  const [submitted, setSubmitted] = useState<{ naics: string; agency: string } | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!naics.trim()) return
    setSubmitted({ naics: naics.trim(), agency: agency.trim() })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Competitor Intelligence</h1>
      <p className="text-sm text-gray-400 mb-4">
        Discover who&apos;s winning federal contracts in your target market. Powered by USASpending.gov public data.
      </p>

      <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl px-4 py-3 mb-6 text-sm text-gray-300">
        <strong className="text-gray-100">How this works:</strong> This shows companies that have previously won federal contracts in this NAICS code — your likely competition. Use it to understand the competitive landscape before submitting a bid.
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 flex flex-wrap gap-4 items-end"
      >
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label htmlFor="naics" className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            NAICS Code *
          </label>
          <input
            id="naics"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 238210"
            value={naics}
            onChange={(e) => setNaics(e.target.value)}
            maxLength={6}
            required
            className="border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label htmlFor="agency" className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Agency (optional)
          </label>
          <input
            id="agency"
            type="text"
            placeholder="e.g. Department of Defense"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className="border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors"
        >
          Search
        </button>
      </form>

      {submitted && (
        <CompetitorIntelPanel
          naics={submitted.naics}
          agency={submitted.agency || null}
          opportunityId="standalone"
        />
      )}
    </main>
  )
}
