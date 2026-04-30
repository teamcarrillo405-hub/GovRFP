'use client'

import { useState } from 'react'
import { TeamingPartnersPanel } from '@/components/teaming/TeamingPartnersPanel'
import { US_STATES } from '@/lib/validators/profile'

export default function TeamingPage() {
  const [naics, setNaics] = useState('')
  const [state, setState] = useState('')
  const [submitted, setSubmitted] = useState<{ naics: string; state: string } | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!naics.trim()) return
    setSubmitted({ naics: naics.trim(), state: state.trim() })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Find Teaming Partners</h1>
      <p className="text-sm text-gray-400 mb-6">
        Discover contractors who have won similar federal contracts — potential primes or subs for
        your next bid. Powered by USASpending.gov public data.
      </p>

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

        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label htmlFor="state" className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            State (optional)
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="border border-white/10 bg-[#0B0B0D] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <option value="">Any state</option>
            {US_STATES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors"
        >
          Search
        </button>
      </form>

      {submitted && (
        <TeamingPartnersPanel
          naics={submitted.naics}
          state={submitted.state || null}
          opportunityId="standalone"
        />
      )}
    </main>
  )
}
