'use client'

import { useRef, useState, useTransition } from 'react'
import { updateProfile } from '@/app/(dashboard)/profile/actions'
import {
  CERTIFICATION_OPTIONS,
  CONSTRUCTION_TYPE_OPTIONS,
  US_STATES,
} from '@/lib/validators/profile'
import type { ProfileFormData } from '@/lib/validators/profile'
import { WebsiteScrapeWidget } from './WebsiteScrapeWidget'

interface ProfileFormProps {
  initialData: Partial<ProfileFormData> | null
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [charCount, setCharCount] = useState(
    initialData?.capability_statement?.length ?? 0
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setMessage(null)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Profile saved successfully.' })
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Website auto-fill widget */}
      <WebsiteScrapeWidget />

      {/* Company Name */}
      <div>
        <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          id="company_name"
          name="company_name"
          type="text"
          required
          defaultValue={initialData?.company_name ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Acme Contracting LLC"
        />
      </div>

      {/* UEI / CAGE */}
      <div>
        <label htmlFor="uei_cage" className="block text-sm font-medium text-gray-700 mb-1">
          UEI / CAGE Code
        </label>
        <input
          id="uei_cage"
          name="uei_cage"
          type="text"
          defaultValue={initialData?.uei_cage ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. ABC123456789"
        />
      </div>

      {/* Certifications */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Certifications
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CERTIFICATION_OPTIONS.map((cert) => (
            <label key={cert} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="certifications"
                value={cert}
                defaultChecked={initialData?.certifications?.includes(cert) ?? false}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {cert}
            </label>
          ))}
        </div>
      </fieldset>

      {/* NAICS Codes */}
      <div>
        <label htmlFor="naics_codes" className="block text-sm font-medium text-gray-700 mb-1">
          NAICS Codes
        </label>
        <input
          id="naics_codes"
          name="naics_codes"
          type="text"
          defaultValue={initialData?.naics_codes?.join(', ') ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="236220, 541611 (comma-separated 6-digit codes)"
        />
        <p className="mt-1 text-xs text-gray-500">Enter comma-separated 6-digit NAICS codes.</p>
      </div>

      {/* ── Business Capacity ─────────────────────────────────────────── */}
      <fieldset className="rounded-lg border border-gray-200 p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Business Capacity</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="annual_revenue_usd" className="block text-sm font-medium text-gray-700 mb-1">
              Annual Revenue
            </label>
            <input
              id="annual_revenue_usd"
              name="annual_revenue_usd"
              type="text"
              defaultValue={initialData?.annual_revenue_usd != null ? String(initialData.annual_revenue_usd) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="$2,500,000"
            />
          </div>

          <div>
            <label htmlFor="max_project_size_usd" className="block text-sm font-medium text-gray-700 mb-1">
              Max Single Project Size
            </label>
            <input
              id="max_project_size_usd"
              name="max_project_size_usd"
              type="text"
              defaultValue={initialData?.max_project_size_usd != null ? String(initialData.max_project_size_usd) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="$1,000,000"
            />
          </div>

          <div>
            <label htmlFor="bonding_single_usd" className="block text-sm font-medium text-gray-700 mb-1">
              Single Project Bonding Limit
            </label>
            <input
              id="bonding_single_usd"
              name="bonding_single_usd"
              type="text"
              defaultValue={initialData?.bonding_single_usd != null ? String(initialData.bonding_single_usd) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="$5,000,000"
            />
          </div>

          <div>
            <label htmlFor="bonding_aggregate_usd" className="block text-sm font-medium text-gray-700 mb-1">
              Aggregate Bonding Limit
            </label>
            <input
              id="bonding_aggregate_usd"
              name="bonding_aggregate_usd"
              type="text"
              defaultValue={initialData?.bonding_aggregate_usd != null ? String(initialData.bonding_aggregate_usd) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="$10,000,000"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="surety_company" className="block text-sm font-medium text-gray-700 mb-1">
              Surety Company
            </label>
            <input
              id="surety_company"
              name="surety_company"
              type="text"
              defaultValue={initialData?.surety_company ?? ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Travelers, Zurich National"
            />
          </div>

          <div>
            <label htmlFor="employee_count" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Employees
            </label>
            <input
              id="employee_count"
              name="employee_count"
              type="number"
              min={0}
              defaultValue={initialData?.employee_count != null ? String(initialData.employee_count) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="years_in_business" className="block text-sm font-medium text-gray-700 mb-1">
              Years in Business
            </label>
            <input
              id="years_in_business"
              name="years_in_business"
              type="number"
              min={0}
              defaultValue={initialData?.years_in_business != null ? String(initialData.years_in_business) : ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="sam_gov_registered"
              defaultChecked={initialData?.sam_gov_registered ?? false}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Registered on SAM.gov
          </label>

          <div>
            <label htmlFor="sba_size_category" className="block text-sm font-medium text-gray-700 mb-1">
              SBA Size Category
            </label>
            <select
              id="sba_size_category"
              name="sba_size_category"
              defaultValue={initialData?.sba_size_category ?? ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              <option value="small">Small Business</option>
              <option value="other_than_small">Other Than Small</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* ── Construction Types ────────────────────────────────────────── */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Construction Types</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONSTRUCTION_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="construction_types"
                value={opt.value}
                defaultChecked={
                  (initialData?.construction_types as string[] | undefined)?.includes(opt.value) ?? false
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ── Geographic Coverage ───────────────────────────────────────── */}
      <fieldset className="rounded-lg border border-gray-200 p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Geographic Coverage</legend>

        <div>
          <label htmlFor="primary_state" className="block text-sm font-medium text-gray-700 mb-1">
            Primary State
          </label>
          <select
            id="primary_state"
            name="primary_state"
            defaultValue={initialData?.primary_state ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          >
            <option value="">-- Select state --</option>
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">
            States Where You Work
          </p>
          <div
            className="grid grid-cols-3 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-gray-200 p-3"
            style={{ maxHeight: '200px' }}
          >
            {US_STATES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="geographic_states"
                  value={s.value}
                  defaultChecked={
                    (initialData?.geographic_states as string[] | undefined)?.includes(s.value) ?? false
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {s.value}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">Select all states where your company performs work.</p>
        </div>
      </fieldset>

      {/* Capability Statement */}
      <div>
        <label htmlFor="capability_statement" className="block text-sm font-medium text-gray-700 mb-1">
          Capability Statement
        </label>
        <textarea
          id="capability_statement"
          name="capability_statement"
          rows={8}
          maxLength={2000}
          defaultValue={initialData?.capability_statement ?? ''}
          onChange={(e) => setCharCount(e.target.value.length)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="Describe your company's core competencies, differentiators, and relevant experience..."
        />
        <p className="mt-1 text-xs text-gray-500 text-right">{charCount}/2000</p>
      </div>

      {/* Differentiators */}
      <div>
        <label htmlFor="differentiators" className="block text-sm font-medium text-gray-700 mb-1">
          Key Differentiators
        </label>
        <textarea
          id="differentiators"
          name="differentiators"
          rows={3}
          maxLength={1000}
          defaultValue={(initialData as Record<string, unknown> | null)?.differentiators as string ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="What sets your company apart — certifications, specialized equipment, local relationships, safety record..."
        />
        <p className="mt-1 text-xs text-gray-500">Used by AI to write stronger win themes in proposals.</p>
      </div>

      {/* Website URL + EMR row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-1">
            Company Website
          </label>
          <input
            id="website_url"
            name="website_url"
            type="url"
            defaultValue={(initialData as Record<string, unknown> | null)?.website_url as string ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="https://yourcompany.com"
          />
        </div>
        <div>
          <label htmlFor="emr" className="block text-sm font-medium text-gray-700 mb-1">
            EMR (Experience Modification Rate)
          </label>
          <input
            id="emr"
            name="emr"
            type="number"
            step="0.01"
            min="0"
            max="9.99"
            defaultValue={(initialData as Record<string, unknown> | null)?.emr as string ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. 0.82"
          />
          <p className="mt-1 text-xs text-gray-500">Safety rating used in federal construction proposals. Below 1.0 is good.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#2F80FF', focusRingColor: '#2F80FF' } as React.CSSProperties}
        >
          {isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
