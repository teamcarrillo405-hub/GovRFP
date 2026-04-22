'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  CPARS_LABELS,
  CPARS_RATINGS,
  SET_ASIDE_CODES,
  type PastPerformanceInput,
  type CparsRating,
} from '@/lib/past-performance/types'
import { isRedirectError } from '@/lib/supabase/is-redirect-error'

/**
 * Single-page form used for:
 *   - Editing existing records (/past-performance/[id])
 *   - "Skip wizard" create flow (/past-performance/new?skip-wizard=1)
 *
 * The wizard (WizardShell + 3 steps) reuses the same input type and
 * server action — this form is just a flat alternative surface for
 * power users who don't need the hand-holding.
 */

interface Props {
  initial?: Partial<PastPerformanceInput>
  onSubmit: (data: PastPerformanceInput) => Promise<void>
  onDelete?: () => Promise<void>
  submitLabel?: string
}

const EMPTY: PastPerformanceInput = {
  contract_title: '',
  customer_name: '',
  scope_narrative: '',
  naics_codes: [],
  set_asides_claimed: [],
  key_personnel: [],
  tags: [],
}

export function PastPerformanceForm({
  initial = {},
  onSubmit,
  onDelete,
  submitLabel = 'Save record',
}: Props) {
  const [data, setData] = useState<PastPerformanceInput>({ ...EMPTY, ...initial })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof PastPerformanceInput>(key: K, value: PastPerformanceInput[K]) =>
    setData((d) => ({ ...d, [key]: value }))

  const submit = () => {
    setError(null)
    startTransition(async () => {
      try {
        await onSubmit(data)
      } catch (e) {
        if (isRedirectError(e)) throw e
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  return (
    <div className="space-y-8">
      <Section title="Contract">
        <Field label="Contract title" required>
          <input
            type="text"
            value={data.contract_title}
            onChange={(e) => update('contract_title', e.target.value)}
            className={inputCls}
            maxLength={300}
            required
          />
        </Field>
        <Field label="Contract number">
          <input
            type="text"
            value={data.contract_number ?? ''}
            onChange={(e) => update('contract_number', e.target.value || null)}
            className={inputCls}
            placeholder="e.g. W912DR-23-C-0042"
          />
        </Field>
        <Field label="Customer (agency or prime)" required>
          <input
            type="text"
            value={data.customer_name}
            onChange={(e) => update('customer_name', e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Agency code">
          <input
            type="text"
            value={data.customer_agency_code ?? ''}
            onChange={(e) => update('customer_agency_code', e.target.value || null)}
            className={inputCls}
            placeholder="USACE, DOD, USDA..."
          />
        </Field>
        <Field label="Contact name">
          <input
            type="text"
            value={data.customer_poc_name ?? ''}
            onChange={(e) => update('customer_poc_name', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={data.customer_poc_email ?? ''}
            onChange={(e) => update('customer_poc_email', e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Period & Scale">
        <Field label="Period start">
          <input
            type="date"
            value={data.period_start ?? ''}
            onChange={(e) => update('period_start', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Period end">
          <input
            type="date"
            value={data.period_end ?? ''}
            onChange={(e) => update('period_end', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Contract value (USD)">
          <input
            type="number"
            min={0}
            step={1000}
            value={data.contract_value_usd ?? ''}
            onChange={(e) =>
              update(
                'contract_value_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="NAICS codes (comma-separated 6-digit)">
          <input
            type="text"
            value={data.naics_codes.join(', ')}
            onChange={(e) =>
              update(
                'naics_codes',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => /^\d{6}$/.test(s)),
              )
            }
            className={inputCls}
            placeholder="236220, 237310"
          />
          {data.naics_codes.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">{data.naics_codes.length} valid code(s)</p>
          )}
        </Field>
        <Field label="Set-asides claimed">
          <div className="flex flex-wrap gap-2 mt-1">
            {SET_ASIDE_CODES.map((code) => {
              const checked = data.set_asides_claimed.includes(code)
              return (
                <label
                  key={code}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer border ${
                    checked
                      ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update(
                        'set_asides_claimed',
                        checked
                          ? data.set_asides_claimed.filter((c) => c !== code)
                          : [...data.set_asides_claimed, code],
                      )
                    }
                    className="w-3 h-3"
                  />
                  {code}
                </label>
              )
            })}
          </div>
        </Field>
      </Section>

      <Section title="Scope & Outcomes">
        <Field label="Scope narrative" required hint="200–500 words. Keep evergreen — the LLM tailors per RFP at draft time.">
          <textarea
            value={data.scope_narrative}
            onChange={(e) => update('scope_narrative', e.target.value)}
            className={`${inputCls} min-h-40 font-sans leading-relaxed`}
            maxLength={5000}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            {data.scope_narrative.length} / 5000
          </p>
        </Field>
        <Field label="Outcomes" hint="Measurable results, awards, on-time/on-budget metrics.">
          <textarea
            value={data.outcomes ?? ''}
            onChange={(e) => update('outcomes', e.target.value || null)}
            className={`${inputCls} min-h-24`}
            maxLength={2000}
          />
        </Field>
        <Field label="CPARS rating">
          <select
            value={data.cpars_rating ?? ''}
            onChange={(e) =>
              update('cpars_rating', (e.target.value || null) as CparsRating | null)
            }
            className={inputCls}
          >
            <option value="">— not rated —</option>
            {CPARS_RATINGS.map((r) => (
              <option key={r} value={r}>
                {CPARS_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags (comma-separated)">
          <input
            type="text"
            value={data.tags.join(', ')}
            onChange={(e) =>
              update(
                'tags',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
            className={inputCls}
            placeholder="design-build, federal, healthcare"
          />
        </Field>
      </Section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link href="/past-performance" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to library
        </Link>
        <div className="flex gap-3">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this record? This cannot be undone.')) {
                  startTransition(async () => {
                    try {
                      await onDelete()
                    } catch (e) {
                      if (isRedirectError(e)) throw e
                      setError(e instanceof Error ? e.message : 'Delete failed')
                    }
                  })
                }
              }}
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="px-5 py-2 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-50"
            style={{ backgroundColor: '#F5C518' }}
          >
            {isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className={children && (label === 'Scope narrative' || label === 'Outcomes' || label === 'Tags (comma-separated)' || label === 'Set-asides claimed') ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
