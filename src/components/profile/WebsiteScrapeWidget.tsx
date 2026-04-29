'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CERTIFICATION_OPTIONS, CONSTRUCTION_TYPE_OPTIONS } from '@/lib/validators/profile'

interface Extracted {
  company_name?: string | null
  capability_statement?: string | null
  differentiators?: string | null
  construction_types?: string[]
  certifications?: string[]
  geographic_states?: string[]
  years_in_business?: number | null
  employee_count?: number | null
}

type Status = 'idle' | 'loading' | 'preview' | 'saving' | 'done' | 'error'

export function WebsiteScrapeWidget() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pagesRead, setPagesRead] = useState(0)
  const [data, setData] = useState<Extracted>({})

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/user/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Analysis failed')
      setData(body.extracted ?? {})
      setPagesRead(body.pages_read ?? 0)
      setStatus('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setStatus('error')
    }
  }

  const handleApply = async () => {
    setStatus('saving')
    setError(null)

    try {
      const res = await fetch('/api/user/apply-website-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to apply')
      setStatus('done')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply')
      setStatus('preview')
    }
  }

  const fieldLabel = (key: string) => ({
    company_name: 'Company Name',
    capability_statement: 'Capability Statement',
    differentiators: 'Differentiators',
    construction_types: 'Construction Types',
    certifications: 'Certifications',
    geographic_states: 'States Served',
    years_in_business: 'Years in Business',
    employee_count: 'Employee Count',
  }[key] ?? key)

  const hasData = Object.values(data).some((v) =>
    v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0)
  )

  return (
    <div className="rounded-lg border border-[#2F80FF] bg-[#F0F6FF] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Auto-fill from your website</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter your company website and we will read it to pre-fill your profile.
          </p>
        </div>
        {status === 'done' && (
          <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded-full">
            Applied
          </span>
        )}
      </div>

      {/* URL input row */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="https://yourcompany.com"
          disabled={status === 'loading' || status === 'saving'}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent disabled:opacity-50 bg-white"
        />
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!url.trim() || status === 'loading' || status === 'saving'}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-[#2F80FF] hover:bg-[#2568CC] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
        >
          {status === 'loading' ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Reading...
            </>
          ) : 'Analyze'}
        </button>
      </div>

      {status === 'loading' && (
        <p className="text-xs text-gray-500 mt-2">
          Reading your website pages and extracting business information...
        </p>
      )}

      {(status === 'error') && error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}

      {/* Preview */}
      {(status === 'preview' || status === 'saving' || status === 'done') && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">
            Read {pagesRead} page{pagesRead !== 1 ? 's' : ''} from your website. Review and edit the extracted data below before applying.
          </p>

          {!hasData && (
            <p className="text-xs text-gray-500 italic">No data could be extracted. The site may require authentication or JavaScript rendering.</p>
          )}

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">

            {data.company_name && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">{fieldLabel('company_name')}</label>
                <input
                  type="text"
                  value={data.company_name ?? ''}
                  onChange={(e) => setData((d) => ({ ...d, company_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2F80FF]"
                />
              </div>
            )}

            {data.capability_statement && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">{fieldLabel('capability_statement')}</label>
                <textarea
                  value={data.capability_statement ?? ''}
                  onChange={(e) => setData((d) => ({ ...d, capability_statement: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2F80FF] resize-none"
                />
              </div>
            )}

            {data.differentiators && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">{fieldLabel('differentiators')}</label>
                <textarea
                  value={data.differentiators ?? ''}
                  onChange={(e) => setData((d) => ({ ...d, differentiators: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2F80FF] resize-none"
                />
              </div>
            )}

            {data.construction_types && data.construction_types.length > 0 && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-2">{fieldLabel('construction_types')}</label>
                <div className="flex flex-wrap gap-2">
                  {CONSTRUCTION_TYPE_OPTIONS.map(({ value, label }) => {
                    const checked = data.construction_types?.includes(value) ?? false
                    return (
                      <label key={value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setData((d) => ({
                            ...d,
                            construction_types: e.target.checked
                              ? [...(d.construction_types ?? []), value]
                              : (d.construction_types ?? []).filter((v) => v !== value),
                          }))}
                          className="rounded"
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {data.certifications && data.certifications.length > 0 && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-2">{fieldLabel('certifications')}</label>
                <div className="flex flex-wrap gap-3">
                  {CERTIFICATION_OPTIONS.map((cert) => {
                    const checked = data.certifications?.includes(cert) ?? false
                    return (
                      <label key={cert} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setData((d) => ({
                            ...d,
                            certifications: e.target.checked
                              ? [...(d.certifications ?? []), cert]
                              : (d.certifications ?? []).filter((v) => v !== cert),
                          }))}
                          className="rounded"
                        />
                        {cert}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {((data.years_in_business ?? null) !== null || (data.employee_count ?? null) !== null) && (
              <div className="px-4 py-3 grid grid-cols-2 gap-4">
                {(data.years_in_business ?? null) !== null && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{fieldLabel('years_in_business')}</label>
                    <input
                      type="number"
                      value={data.years_in_business ?? ''}
                      onChange={(e) => setData((d) => ({ ...d, years_in_business: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2F80FF]"
                    />
                  </div>
                )}
                {(data.employee_count ?? null) !== null && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{fieldLabel('employee_count')}</label>
                    <input
                      type="number"
                      value={data.employee_count ?? ''}
                      onChange={(e) => setData((d) => ({ ...d, employee_count: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2F80FF]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {hasData && status !== 'done' && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={status === 'saving'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
              >
                {status === 'saving' ? 'Applying...' : 'Apply to Profile'}
              </button>
            </div>
          )}

          {status === 'done' && (
            <p className="text-xs text-green-700 font-medium text-center pt-1">
              Profile updated. You can review and adjust the fields below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
