'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CPARS_LABELS,
  CPARS_RATINGS,
  SET_ASIDE_CODES,
  type PastPerformanceInput,
  type CparsRating,
} from '@/lib/past-performance/types'
import { isRedirectError } from '@/lib/supabase/is-redirect-error'
import { bulkCreatePastPerformance } from '@/app/(dashboard)/past-performance/actions'

interface Props {
  onSubmit: (data: PastPerformanceInput) => Promise<void>
}

type Step = 1 | 2 | 3

const EMPTY: PastPerformanceInput = {
  contract_title: '',
  customer_name: '',
  scope_narrative: '',
  naics_codes: [],
  set_asides_claimed: [],
  key_personnel: [],
  tags: [],
}

export function WizardShell({ onSubmit }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<PastPerformanceInput>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Paste-and-extract state
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Multi-record bulk-save state
  const [extractedRecords, setExtractedRecords] = useState<PastPerformanceInput[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // USASpending lookup state
  const [lookupPending, setLookupPending] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const update = <K extends keyof PastPerformanceInput>(key: K, value: PastPerformanceInput[K]) =>
    setData((d) => ({ ...d, [key]: value }))

  const canAdvance = (() => {
    if (step === 1) return data.contract_title.trim() && data.customer_name.trim()
    if (step === 2) return data.scope_narrative.trim().length >= 50
    return true
  })()

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

  const prefillForm = (rec: PastPerformanceInput) => {
    setData((d) => ({
      ...d,
      contract_title: rec.contract_title || d.contract_title,
      contract_number: rec.contract_number ?? d.contract_number,
      customer_name: rec.customer_name || d.customer_name,
      customer_agency_code: rec.customer_agency_code ?? d.customer_agency_code,
      period_start: rec.period_start ?? d.period_start,
      period_end: rec.period_end ?? d.period_end,
      contract_value_usd: rec.contract_value_usd ?? d.contract_value_usd,
      naics_codes: rec.naics_codes?.length ? rec.naics_codes : d.naics_codes,
      set_asides_claimed: rec.set_asides_claimed?.length ? rec.set_asides_claimed : d.set_asides_claimed,
      scope_narrative: rec.scope_narrative || d.scope_narrative,
      outcomes: rec.outcomes ?? d.outcomes,
      cpars_rating: rec.cpars_rating ?? d.cpars_rating,
      tags: rec.tags?.length ? rec.tags : d.tags,
    }))
  }

  const handleExtract = async () => {
    if (!pasteText.trim() || extracting) return
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await fetch('/api/past-performance/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const json = await res.json() as { records?: PastPerformanceInput[]; error?: string }
      if (!res.ok || !json.records?.length) {
        setExtractError(json.error ?? 'No records extracted')
        return
      }

      setShowPaste(false)
      setPasteText('')

      if (json.records.length === 1) {
        // Original single-record behavior — pre-fill wizard and continue.
        prefillForm(json.records[0])
      } else {
        // Multiple records — show bulk-confirm panel instead of continuing wizard.
        setExtractedRecords(json.records)
        setBulkError(null)
      }
    } catch {
      setExtractError('Extraction failed — try again')
    } finally {
      setExtracting(false)
    }
  }

  const handleBulkSave = async () => {
    setBulkSaving(true)
    setBulkError(null)
    try {
      await bulkCreatePastPerformance(extractedRecords)
      router.push('/past-performance')
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Failed to save records')
      setBulkSaving(false)
    }
  }

  const handleReviewFirst = () => {
    if (extractedRecords.length === 0) return
    prefillForm(extractedRecords[0])
    setExtractedRecords([])
    setBulkError(null)
  }

  const handleLookup = async () => {
    const piid = data.contract_number?.trim()
    if (!piid || lookupPending) return
    setLookupPending(true)
    setLookupError(null)
    try {
      const res = await fetch(`/api/past-performance/usaspending?piid=${encodeURIComponent(piid)}`)
      const json = await res.json() as {
        found: boolean
        data?: {
          customer_name: string | null
          customer_agency_code: string | null
          contract_value_usd: number | null
          period_start: string | null
          period_end: string | null
          naics_code: string | null
        }
        error?: string
      }
      if (!res.ok) { setLookupError(json.error ?? 'Lookup failed'); return }
      if (!json.found) { setLookupError('Contract not found in USASpending'); return }
      const d = json.data!
      setData((prev) => ({
        ...prev,
        customer_name: d.customer_name || prev.customer_name,
        customer_agency_code: d.customer_agency_code ?? prev.customer_agency_code,
        contract_value_usd: d.contract_value_usd ?? prev.contract_value_usd,
        period_start: d.period_start ?? prev.period_start,
        period_end: d.period_end ?? prev.period_end,
        naics_codes: d.naics_code ? [d.naics_code] : prev.naics_codes,
      }))
    } catch {
      setLookupError('Lookup failed — try again')
    } finally {
      setLookupPending(false)
    }
  }

  // ---------- bulk-confirm panel ----------
  if (extractedRecords.length > 1) {
    return (
      <div>
        <div className="rounded-md border border-green-200 bg-green-50 p-5 text-sm">
          <p className="font-semibold text-green-900 mb-3">
            Found {extractedRecords.length} records. Ready to save all at once?
          </p>
          <ol className="mb-4 space-y-1 text-green-800 text-xs list-decimal list-inside">
            {extractedRecords.map((rec, i) => {
              const period =
                rec.period_start || rec.period_end
                  ? ` (${rec.period_start?.slice(0, 4) ?? '?'}–${rec.period_end?.slice(0, 4) ?? '?'})`
                  : ''
              return (
                <li key={i}>
                  <strong>{rec.contract_title || '(untitled)'}</strong>
                  {rec.customer_name ? ` — ${rec.customer_name}` : ''}
                  {period}
                </li>
              )
            })}
          </ol>
          {bulkError && (
            <p className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {bulkError}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className="px-4 py-2 text-xs font-semibold rounded-md text-gray-900 disabled:opacity-50"
              style={{ backgroundColor: '#F5C518' }}
            >
              {bulkSaving ? 'Saving…' : `Save all ${extractedRecords.length} records`}
            </button>
            <button
              type="button"
              onClick={handleReviewFirst}
              disabled={bulkSaving}
              className="px-4 py-2 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
            >
              Review first record →
            </button>
          </div>
        </div>
      </div>
    )
  }
  // ----------------------------------------

  return (
    <div>
      <ProgressBar step={step} />

      {step === 1 && (
        <>
          <StepHeader
            title="Identify the contract"
            subtitle="Who was the customer, what was the contract, when and how big?"
          />

          {/* Paste-and-extract */}
          <div className="mb-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm">
            {!showPaste ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-700">
                    Have a prior proposal&rsquo;s PP section?
                  </p>
                  <p className="text-xs text-gray-500">
                    Paste it and we&rsquo;ll extract all fields across all 3 steps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaste(true)}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-white"
                >
                  Paste prior PP
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold text-gray-700 text-xs">Paste your prior PP text below:</p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  maxLength={20_000}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  placeholder="Paste past performance section from a prior proposal…"
                />
                {extractError && <p className="text-xs text-red-600">{extractError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={!pasteText.trim() || extracting}
                    className="px-3 py-1.5 text-xs rounded-md text-gray-900 font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#F5C518' }}
                  >
                    {extracting ? 'Extracting…' : 'Extract fields'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPaste(false); setPasteText(''); setExtractError(null) }}
                    className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contract title" required>
              <input
                type="text"
                value={data.contract_title}
                onChange={(e) => update('contract_title', e.target.value)}
                className={inputCls}
                maxLength={300}
              />
            </Field>
            <Field label="Contract number">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={data.contract_number ?? ''}
                  onChange={(e) => { update('contract_number', e.target.value || null); setLookupError(null) }}
                  className={inputCls}
                  placeholder="W912DR-23-C-0042"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={!data.contract_number?.trim() || lookupPending}
                  title="Look up on USASpending.gov"
                  className="shrink-0 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lookupPending ? '…' : 'Lookup'}
                </button>
              </div>
              {lookupError && <p className="mt-1 text-xs text-red-600">{lookupError}</p>}
            </Field>
            <Field label="Customer" required>
              <input
                type="text"
                value={data.customer_name}
                onChange={(e) => update('customer_name', e.target.value)}
                className={inputCls}
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
            <Field label="PoC name">
              <input
                type="text"
                value={data.customer_poc_name ?? ''}
                onChange={(e) => update('customer_poc_name', e.target.value || null)}
                className={inputCls}
              />
            </Field>
            <Field label="PoC email">
              <input
                type="email"
                value={data.customer_poc_email ?? ''}
                onChange={(e) => update('customer_poc_email', e.target.value)}
                className={inputCls}
              />
            </Field>
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
            <Field label="Contract value (USD)" fullWidth>
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
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <StepHeader
            title="Scope"
            subtitle="What did you do? Write it evergreen — the LLM will tailor per-RFP at draft time."
          />

          <div className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500">
                  {data.naics_codes.length} valid code(s) recognized
                </p>
              )}
            </Field>

            <Field label="Set-asides claimed on this contract">
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

            <Field
              label="Scope narrative"
              required
              hint="200–500 words. Keep it evergreen — no references to specific current RFPs."
            >
              <textarea
                value={data.scope_narrative}
                onChange={(e) => update('scope_narrative', e.target.value)}
                className={`${inputCls} min-h-48 font-sans leading-relaxed`}
                maxLength={5000}
              />
              <p className="mt-1 text-xs text-gray-500">
                {data.scope_narrative.length} / 5000
                {data.scope_narrative.trim().length < 50 && data.scope_narrative.length > 0 && (
                  <span className="text-yellow-700 ml-2">
                    (need at least 50 chars to continue)
                  </span>
                )}
              </p>
            </Field>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <StepHeader
            title="Outcomes"
            subtitle="How did it end? CPARS rating, measurable results, taxonomy tags."
          />

          <div className="space-y-4">
            <Field label="Outcomes" hint="Measurable results. Awards, on-time delivery, cost savings.">
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

            <Field
              label="Tags"
              hint="Free-form taxonomy. Examples: design-build, renovation, federal, healthcare, LEED-certified."
            >
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
                placeholder="design-build, renovation, healthcare"
              />
            </Field>

            <div className="mt-6 rounded-md bg-gray-50 border border-gray-200 p-4 text-sm">
              <p className="font-semibold text-gray-900 mb-2">Ready to save:</p>
              <ul className="text-gray-600 space-y-0.5 text-xs">
                <li>
                  <strong className="text-gray-900">{data.contract_title || '(no title)'}</strong>
                  {data.contract_number && <> — #{data.contract_number}</>}
                </li>
                <li>Customer: {data.customer_name || '(missing)'}</li>
                <li>
                  NAICS: {data.naics_codes.join(', ') || '—'} · Set-asides:{' '}
                  {data.set_asides_claimed.join(', ') || '—'}
                </li>
                <li>Scope: {data.scope_narrative.length} chars</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
          )}
          <Link
            href="/past-performance/new?skip-wizard=1"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Skip wizard, show all fields
          </Link>
        </div>

        {step < 3 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="px-5 py-2 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#F5C518' }}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={submit}
            className="px-5 py-2 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-50"
            style={{ backgroundColor: '#F5C518' }}
          >
            {isPending ? 'Saving…' : 'Save record'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------- shared primitives ----------------

const inputCls =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500'

function ProgressBar({ step }: { step: Step }) {
  const labels = ['Identify', 'Scope', 'Outcomes']
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        const active = step === n
        const done = step > n
        return (
          <div key={label} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-2 ${
                active ? 'text-gray-900' : done ? 'text-gray-600' : 'text-gray-500'
              }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  active || done
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? '✓' : n}
              </span>
              <span className="text-sm font-medium">{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 ${done ? 'bg-yellow-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  fullWidth,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  fullWidth?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
