'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  EMPLOYEE_COUNT_RANGES,
  CLEARANCE_LEVELS,
  CLEARANCE_LABELS,
  type CapabilityStatementInput,
  type EmployeeCountRange,
  type ClearanceLevel,
} from '@/lib/capability-statement/types'
import { SET_ASIDE_CODES } from '@/lib/past-performance/types'
import { isRedirectError } from '@/lib/supabase/is-redirect-error'

/**
 * Capability Statement editor — single record per team or solo user.
 * Sectioned form (collapsible accordions) due to ~50 fields. Heterogeneous
 * data (facilities, equipment, awards, vouching contacts) uses tiny inline
 * row editors so the user doesn't need a separate page per item.
 */

const EMPTY: CapabilityStatementInput = {
  company_name: '',
  certifications: [],
  certification_dates: {},
  naics_codes: [],
  differentiators: [],
  annual_revenue: [],
  states_active: [],
  gsa_regions: [],
  facilities: [],
  equipment: [],
  clearance_counts: {},
  awards: [],
  vouching_contacts: [],
}

interface Props {
  initial?: Partial<CapabilityStatementInput>
  saved?: boolean
  onSubmit: (input: CapabilityStatementInput) => Promise<void>
}

export function CapabilityStatementForm({ initial = {}, saved = false, onSubmit }: Props) {
  const [data, setData] = useState<CapabilityStatementInput>({ ...EMPTY, ...initial })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof CapabilityStatementInput>(
    key: K,
    value: CapabilityStatementInput[K],
  ) => setData((d) => ({ ...d, [key]: value }))

  const submit = () => {
    setError(null)
    startTransition(async () => {
      try {
        await onSubmit(data)
      } catch (e) {
        if (isRedirectError(e)) throw e
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Saved.
        </div>
      )}

      <Section title="Identity" defaultOpen>
        <Field label="Company name" required>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            className={inputCls}
            maxLength={200}
            required
          />
        </Field>
        <Field label="DBA (doing business as)">
          <input
            type="text"
            value={data.dba_name ?? ''}
            onChange={(e) => update('dba_name', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="UEI (SAM.gov Unique Entity ID)">
          <input
            type="text"
            value={data.uei ?? ''}
            onChange={(e) => update('uei', e.target.value || null)}
            className={inputCls}
            placeholder="12-character alphanumeric"
          />
        </Field>
        <Field label="CAGE code">
          <input
            type="text"
            value={data.cage_code ?? ''}
            onChange={(e) => update('cage_code', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="DUNS (legacy)">
          <input
            type="text"
            value={data.duns_number ?? ''}
            onChange={(e) => update('duns_number', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Founding year">
          <input
            type="number"
            min={1800}
            max={2100}
            value={data.founding_year ?? ''}
            onChange={(e) =>
              update('founding_year', e.target.value ? Number(e.target.value) : null)
            }
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Headquarters & Contact">
        <Field label="HQ address" fullWidth>
          <input
            type="text"
            value={data.hq_address ?? ''}
            onChange={(e) => update('hq_address', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="City">
          <input
            type="text"
            value={data.hq_city ?? ''}
            onChange={(e) => update('hq_city', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="State (2-letter)">
          <input
            type="text"
            maxLength={2}
            value={data.hq_state ?? ''}
            onChange={(e) => update('hq_state', e.target.value.toUpperCase())}
            className={inputCls}
          />
        </Field>
        <Field label="ZIP">
          <input
            type="text"
            value={data.hq_zip ?? ''}
            onChange={(e) => update('hq_zip', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={data.website_url ?? ''}
            onChange={(e) => update('website_url', e.target.value)}
            className={inputCls}
            placeholder="https://"
          />
        </Field>
        <Field label="Primary contact name">
          <input
            type="text"
            value={data.primary_contact_name ?? ''}
            onChange={(e) => update('primary_contact_name', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Primary contact title">
          <input
            type="text"
            value={data.primary_contact_title ?? ''}
            onChange={(e) => update('primary_contact_title', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Primary contact email">
          <input
            type="email"
            value={data.primary_contact_email ?? ''}
            onChange={(e) => update('primary_contact_email', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Primary contact phone">
          <input
            type="tel"
            value={data.primary_contact_phone ?? ''}
            onChange={(e) => update('primary_contact_phone', e.target.value || null)}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Certifications & NAICS">
        <Field label="Set-aside certifications" fullWidth>
          <div className="flex flex-wrap gap-2 mt-1">
            {SET_ASIDE_CODES.map((code) => {
              const checked = data.certifications.includes(code)
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
                        'certifications',
                        checked
                          ? data.certifications.filter((c) => c !== code)
                          : [...data.certifications, code],
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
        <Field label="Primary NAICS (6-digit)">
          <input
            type="text"
            value={data.primary_naics ?? ''}
            onChange={(e) => update('primary_naics', e.target.value || null)}
            className={inputCls}
            placeholder="236220"
          />
        </Field>
        <Field label="All NAICS (comma-separated)" fullWidth>
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
            placeholder="236220, 237310, 238210"
          />
        </Field>
      </Section>

      <Section title="Capabilities">
        <Field
          label="Capability narrative"
          fullWidth
          hint="Evergreen — what your firm does, scale, geography, specialties. 200-500 words."
        >
          <textarea
            value={data.capability_narrative ?? ''}
            onChange={(e) => update('capability_narrative', e.target.value || null)}
            className={`${inputCls} min-h-32`}
            maxLength={5000}
          />
          <p className="mt-1 text-xs text-gray-500">
            {(data.capability_narrative?.length ?? 0)} / 5000
          </p>
        </Field>
        <Field
          label="Differentiators (one per line)"
          fullWidth
          hint="3-5 sharp bullets. What makes you the best choice over competitors?"
        >
          <textarea
            value={data.differentiators.join('\n')}
            onChange={(e) =>
              update(
                'differentiators',
                e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 10),
              )
            }
            className={`${inputCls} min-h-24`}
          />
        </Field>
      </Section>

      <Section title="Bonding & Insurance">
        <Field label="Bonding capacity — single ($)">
          <input
            type="number"
            min={0}
            step={50000}
            value={data.bonding_capacity_single_usd ?? ''}
            onChange={(e) =>
              update(
                'bonding_capacity_single_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="Bonding capacity — aggregate ($)">
          <input
            type="number"
            min={0}
            step={50000}
            value={data.bonding_capacity_aggregate_usd ?? ''}
            onChange={(e) =>
              update(
                'bonding_capacity_aggregate_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="Bonding company">
          <input
            type="text"
            value={data.bonding_company ?? ''}
            onChange={(e) => update('bonding_company', e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <Field label="Professional liability ($)">
          <input
            type="number"
            min={0}
            step={50000}
            value={data.professional_liability_usd ?? ''}
            onChange={(e) =>
              update(
                'professional_liability_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="General liability ($)">
          <input
            type="number"
            min={0}
            step={50000}
            value={data.general_liability_usd ?? ''}
            onChange={(e) =>
              update(
                'general_liability_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Financial Profile">
        <Field label="Employee count range">
          <select
            value={data.employee_count_range ?? ''}
            onChange={(e) =>
              update(
                'employee_count_range',
                (e.target.value || null) as EmployeeCountRange | null,
              )
            }
            className={inputCls}
          >
            <option value="">— select —</option>
            {EMPLOYEE_COUNT_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total contracts completed">
          <input
            type="number"
            min={0}
            value={data.total_contracts_completed ?? ''}
            onChange={(e) =>
              update(
                'total_contracts_completed',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="Total contract value to date ($)">
          <input
            type="number"
            min={0}
            step={100000}
            value={data.total_contract_value_usd ?? ''}
            onChange={(e) =>
              update(
                'total_contract_value_usd',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className={inputCls}
          />
        </Field>
        <RevenueEditor
          rows={data.annual_revenue}
          onChange={(rows) => update('annual_revenue', rows)}
        />
      </Section>

      <Section title="Geographic Reach">
        <Field label="States active (2-letter codes, comma-separated)" fullWidth>
          <input
            type="text"
            value={data.states_active.join(', ')}
            onChange={(e) =>
              update(
                'states_active',
                e.target.value
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter((s) => s.length === 2),
              )
            }
            className={inputCls}
            placeholder="VA, MD, DC, NC"
          />
        </Field>
        <Field label="GSA regions" fullWidth>
          <input
            type="text"
            value={data.gsa_regions.join(', ')}
            onChange={(e) =>
              update(
                'gsa_regions',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
            className={inputCls}
            placeholder="R3, R4, NCR"
          />
        </Field>
      </Section>

      <Section title="Facilities">
        <ListEditor
          items={data.facilities}
          onChange={(items) => update('facilities', items)}
          template={{ address: '', sqft: null, type: 'office' as const }}
          render={(f, onUpdate) => (
            <div className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={f.address}
                placeholder="Address"
                onChange={(e) => onUpdate({ ...f, address: e.target.value })}
                className={`${inputCls} col-span-6`}
              />
              <input
                type="number"
                min={0}
                value={f.sqft ?? ''}
                placeholder="sqft"
                onChange={(e) =>
                  onUpdate({ ...f, sqft: e.target.value ? Number(e.target.value) : null })
                }
                className={`${inputCls} col-span-3`}
              />
              <select
                value={f.type}
                onChange={(e) => onUpdate({ ...f, type: e.target.value as typeof f.type })}
                className={`${inputCls} col-span-3`}
              >
                <option value="office">Office</option>
                <option value="warehouse">Warehouse</option>
                <option value="yard">Yard</option>
                <option value="lab">Lab</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
          addLabel="+ Add facility"
        />
      </Section>

      <Section title="Equipment">
        <ListEditor
          items={data.equipment}
          onChange={(items) => update('equipment', items)}
          template={{ type: '', capacity: null, ownership: 'owned' as const }}
          render={(e, onUpdate) => (
            <div className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={e.type}
                placeholder="Equipment type"
                onChange={(ev) => onUpdate({ ...e, type: ev.target.value })}
                className={`${inputCls} col-span-5`}
              />
              <input
                type="text"
                value={e.capacity ?? ''}
                placeholder="Capacity"
                onChange={(ev) => onUpdate({ ...e, capacity: ev.target.value || null })}
                className={`${inputCls} col-span-4`}
              />
              <select
                value={e.ownership}
                onChange={(ev) => onUpdate({ ...e, ownership: ev.target.value as typeof e.ownership })}
                className={`${inputCls} col-span-3`}
              >
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="rented">Rented</option>
              </select>
            </div>
          )}
          addLabel="+ Add equipment"
        />
      </Section>

      <Section title="Security Clearances">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CLEARANCE_LEVELS.map((lvl) => (
            <Field key={lvl} label={CLEARANCE_LABELS[lvl]}>
              <input
                type="number"
                min={0}
                value={data.clearance_counts[lvl] ?? ''}
                onChange={(e) =>
                  update('clearance_counts', {
                    ...data.clearance_counts,
                    [lvl]: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                className={inputCls}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Awards & Recognitions">
        <ListEditor
          items={data.awards}
          onChange={(items) => update('awards', items)}
          template={{ name: '', year: new Date().getFullYear(), issuer: null }}
          render={(a, onUpdate) => (
            <div className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={a.name}
                placeholder="Award name"
                onChange={(e) => onUpdate({ ...a, name: e.target.value })}
                className={`${inputCls} col-span-6`}
              />
              <input
                type="text"
                value={a.issuer ?? ''}
                placeholder="Issuer"
                onChange={(e) => onUpdate({ ...a, issuer: e.target.value || null })}
                className={`${inputCls} col-span-4`}
              />
              <input
                type="number"
                min={1900}
                max={2100}
                value={a.year}
                onChange={(e) => onUpdate({ ...a, year: Number(e.target.value) })}
                className={`${inputCls} col-span-2`}
              />
            </div>
          )}
          addLabel="+ Add award"
        />
      </Section>

      <Section title="Vouching Contacts (References)">
        <ListEditor
          items={data.vouching_contacts}
          onChange={(items) => update('vouching_contacts', items)}
          template={{ name: '', title: null, org: null, email: null, phone: null, relationship: null }}
          render={(c, onUpdate) => (
            <div className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={c.name}
                placeholder="Name"
                onChange={(e) => onUpdate({ ...c, name: e.target.value })}
                className={`${inputCls} col-span-3`}
              />
              <input
                type="text"
                value={c.title ?? ''}
                placeholder="Title"
                onChange={(e) => onUpdate({ ...c, title: e.target.value || null })}
                className={`${inputCls} col-span-3`}
              />
              <input
                type="text"
                value={c.org ?? ''}
                placeholder="Organization"
                onChange={(e) => onUpdate({ ...c, org: e.target.value || null })}
                className={`${inputCls} col-span-3`}
              />
              <input
                type="email"
                value={c.email ?? ''}
                placeholder="Email"
                onChange={(e) => onUpdate({ ...c, email: e.target.value })}
                className={`${inputCls} col-span-3`}
              />
            </div>
          )}
          addLabel="+ Add reference"
        />
      </Section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to dashboard
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-5 py-2 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-50"
          style={{ backgroundColor: '#F5C518' }}
        >
          {isPending ? 'Saving…' : 'Save capability statement'}
        </button>
      </div>
    </div>
  )
}

// ---------------- Inner: revenue history editor ----------------

function RevenueEditor({
  rows,
  onChange,
}: {
  rows: Array<{ year: number; revenue_usd: number }>
  onChange: (rows: Array<{ year: number; revenue_usd: number }>) => void
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
        Annual revenue history (last 3 years recommended)
      </label>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              type="number"
              min={1900}
              max={2100}
              value={r.year}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...r, year: Number(e.target.value) }
                onChange(next)
              }}
              className={`${inputCls} col-span-3`}
              placeholder="Year"
            />
            <input
              type="number"
              min={0}
              step={50000}
              value={r.revenue_usd}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...r, revenue_usd: Number(e.target.value) }
                onChange(next)
              }}
              className={`${inputCls} col-span-7`}
              placeholder="Revenue ($)"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="col-span-2 text-xs text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, { year: new Date().getFullYear(), revenue_usd: 0 }])}
        className="mt-2 text-xs font-semibold text-yellow-800 hover:text-yellow-900"
      >
        + Add year
      </button>
    </div>
  )
}

// ---------------- Inner: generic list-of-rows editor ----------------

function ListEditor<T>({
  items,
  onChange,
  template,
  render,
  addLabel,
}: {
  items: T[]
  onChange: (items: T[]) => void
  template: T
  render: (item: T, onUpdate: (next: T) => void) => React.ReactNode
  addLabel: string
}) {
  return (
    <div className="sm:col-span-2 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {render(item, (next) => {
              const arr = [...items]
              arr[i] = next
              onChange(arr)
            })}
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...template }])}
        className="text-xs font-semibold text-yellow-800 hover:text-yellow-900"
      >
        {addLabel}
      </button>
    </div>
  )
}

// ---------------- shared primitives ----------------

const inputCls =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500'

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-t-md"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-gray-500 text-xs">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-t border-gray-200">
          {children}
        </div>
      )}
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
