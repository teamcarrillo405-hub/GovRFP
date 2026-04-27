'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CERTIFICATION_OPTIONS,
  CONSTRUCTION_TYPE_OPTIONS,
  US_STATES,
} from '@/lib/validators/profile'
import type { ProfileFormData } from '@/lib/validators/profile'
import { completeOnboarding } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardData = Partial<ProfileFormData> & {
  naics_codes_raw?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollar(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

function parseDollar(display: string): number | null {
  const digits = display.replace(/[^0-9]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  color: '#0F172A',
  background: '#fff',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
}

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
}

const HELPER_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  marginTop: 4,
}

function FieldGroup({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
      {helper && <p style={HELPER_STYLE}>{helper}</p>}
    </div>
  )
}

function DollarInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  placeholder?: string
}) {
  const [display, setDisplay] = useState(value != null ? Number(value).toLocaleString('en-US') : '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const formatted = formatDollar(raw)
    setDisplay(formatted)
    onChange(parseDollar(formatted))
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8', pointerEvents: 'none' }}>$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder ?? '0'}
        style={{ ...INPUT_STYLE, paddingLeft: 24 }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Company', 'Certifications', 'Capacity', 'Geography', 'Review']

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1
          const completed = idx < step
          const current = idx === step

          const dotBg = completed ? '#2F80FF' : '#fff'
          const dotBorder = completed || current ? '#2F80FF' : '#CBD5E1'
          const lineColor = completed ? '#2F80FF' : '#E2E8F0'

          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' as const }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* Connector line before dot (except first) */}
                {i > 0 && (
                  <div style={{ width: 48, height: 2, background: lineColor }} />
                )}
                {/* Dot */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: dotBg,
                    border: `2px solid ${dotBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {completed && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {current && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2F80FF' }} />
                  )}
                </div>
              </div>
              {/* Label */}
              <span style={{
                fontSize: 10,
                fontWeight: current ? 700 : 500,
                color: current ? '#2F80FF' : completed ? '#475569' : '#94A3B8',
                marginTop: 6,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                textAlign: 'center' as const,
                minWidth: 56,
              }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Company Basics
// ---------------------------------------------------------------------------

function Step1({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  return (
    <div>
      <FieldGroup label="Company Name *">
        <input
          type="text"
          value={data.company_name ?? ''}
          onChange={e => onChange({ company_name: e.target.value })}
          placeholder="Acme Construction LLC"
          style={INPUT_STYLE}
        />
      </FieldGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FieldGroup label="UEI / CAGE Code">
          <input
            type="text"
            value={data.uei_cage ?? ''}
            onChange={e => onChange({ uei_cage: e.target.value })}
            placeholder="12-character UEI"
            style={INPUT_STYLE}
          />
        </FieldGroup>

        <FieldGroup label="Years in Business">
          <input
            type="number"
            min={0}
            value={data.years_in_business ?? ''}
            onChange={e => onChange({ years_in_business: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder="e.g. 12"
            style={INPUT_STYLE}
          />
        </FieldGroup>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FieldGroup label="Number of Employees">
          <input
            type="number"
            min={0}
            value={data.employee_count ?? ''}
            onChange={e => onChange({ employee_count: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder="e.g. 45"
            style={INPUT_STYLE}
          />
        </FieldGroup>

        <FieldGroup label="SBA Size Category">
          <select
            value={data.sba_size_category ?? ''}
            onChange={e => onChange({ sba_size_category: (e.target.value as 'small' | 'other_than_small') || null })}
            style={SELECT_STYLE}
          >
            <option value="">Select...</option>
            <option value="small">Small</option>
            <option value="other_than_small">Other Than Small</option>
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="SAM.gov Registered">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#0F172A', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={data.sam_gov_registered ?? false}
            onChange={e => onChange({ sam_gov_registered: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: '#2F80FF' }}
          />
          Yes, we are registered on SAM.gov
        </label>
      </FieldGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Certifications & NAICS
// ---------------------------------------------------------------------------

function Step2({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const certs = data.certifications ?? []

  function toggleCert(cert: typeof CERTIFICATION_OPTIONS[number]) {
    if (certs.includes(cert)) {
      onChange({ certifications: certs.filter(c => c !== cert) })
    } else {
      onChange({ certifications: [...certs, cert] })
    }
  }

  return (
    <div>
      <FieldGroup label="Certifications">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {CERTIFICATION_OPTIONS.map(cert => {
            const checked = certs.includes(cert)
            return (
              <label
                key={cert}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  border: `1px solid ${checked ? '#2F80FF' : '#E2E8F0'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: checked ? '#2F80FF14' : '#fff',
                  fontSize: 13,
                  fontWeight: checked ? 700 : 500,
                  color: checked ? '#2F80FF' : '#0F172A',
                  transition: 'all 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCert(cert)}
                  style={{ accentColor: '#2F80FF', width: 15, height: 15 }}
                />
                {cert}
              </label>
            )
          })}
        </div>
      </FieldGroup>

      <FieldGroup
        label="NAICS Codes"
        helper="Enter 6-digit codes separated by commas. e.g. 236220, 237990"
      >
        <input
          type="text"
          value={data.naics_codes_raw ?? (data.naics_codes ?? []).join(', ')}
          onChange={e => onChange({ naics_codes_raw: e.target.value })}
          placeholder="236220, 237990, 238210"
          style={INPUT_STYLE}
        />
      </FieldGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Capacity & Bonding
// ---------------------------------------------------------------------------

function Step3({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const ctypes = data.construction_types ?? []

  function toggleType(val: string) {
    if (ctypes.includes(val as typeof ctypes[number])) {
      onChange({ construction_types: ctypes.filter(t => t !== val) as typeof ctypes })
    } else {
      onChange({ construction_types: [...ctypes, val] as typeof ctypes })
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FieldGroup label="Annual Revenue">
          <DollarInput
            value={data.annual_revenue_usd}
            onChange={v => onChange({ annual_revenue_usd: v })}
            placeholder="5,000,000"
          />
        </FieldGroup>

        <FieldGroup label="Max Single Project Size">
          <DollarInput
            value={data.max_project_size_usd}
            onChange={v => onChange({ max_project_size_usd: v })}
            placeholder="2,000,000"
          />
        </FieldGroup>

        <FieldGroup label="Single Project Bonding Limit">
          <DollarInput
            value={data.bonding_single_usd}
            onChange={v => onChange({ bonding_single_usd: v })}
            placeholder="1,000,000"
          />
        </FieldGroup>

        <FieldGroup label="Aggregate Bonding Limit">
          <DollarInput
            value={data.bonding_aggregate_usd}
            onChange={v => onChange({ bonding_aggregate_usd: v })}
            placeholder="5,000,000"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Surety Company">
        <input
          type="text"
          value={data.surety_company ?? ''}
          onChange={e => onChange({ surety_company: e.target.value })}
          placeholder="e.g. Travelers, Liberty Mutual"
          style={INPUT_STYLE}
        />
      </FieldGroup>

      <FieldGroup label="Construction Types">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {CONSTRUCTION_TYPE_OPTIONS.map(opt => {
            const checked = ctypes.includes(opt.value as typeof ctypes[number])
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  border: `1px solid ${checked ? '#2F80FF' : '#E2E8F0'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: checked ? '#2F80FF14' : '#fff',
                  fontSize: 13,
                  fontWeight: checked ? 700 : 500,
                  color: checked ? '#2F80FF' : '#0F172A',
                  transition: 'all 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleType(opt.value)}
                  style={{ accentColor: '#2F80FF', width: 15, height: 15 }}
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      </FieldGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Geographic Coverage
// ---------------------------------------------------------------------------

function Step4({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const geoStates = data.geographic_states ?? []

  function toggleState(val: string) {
    if (geoStates.includes(val)) {
      onChange({ geographic_states: geoStates.filter(s => s !== val) })
    } else {
      onChange({ geographic_states: [...geoStates, val] })
    }
  }

  return (
    <div>
      <FieldGroup label="Primary State">
        <select
          value={data.primary_state ?? ''}
          onChange={e => onChange({ primary_state: e.target.value })}
          style={SELECT_STYLE}
        >
          <option value="">Select a state...</option>
          {US_STATES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup label="States Where You Work">
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {US_STATES.map(s => {
            const checked = geoStates.includes(s.value)
            return (
              <label
                key={s.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12,
                  color: checked ? '#2F80FF' : '#475569',
                  fontWeight: checked ? 700 : 400,
                  cursor: 'pointer',
                  padding: '3px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleState(s.value)}
                  style={{ accentColor: '#2F80FF', width: 13, height: 13 }}
                />
                {s.label}
              </label>
            )
          })}
        </div>
        {geoStates.length > 0 && (
          <p style={{ ...HELPER_STYLE, marginTop: 6 }}>{geoStates.length} state{geoStates.length !== 1 ? 's' : ''} selected</p>
        )}
      </FieldGroup>

      <FieldGroup
        label="Federal Work Focus"
        helper="What types of federal work do you primarily pursue?"
      >
        <textarea
          rows={3}
          value={data.capability_statement ?? ''}
          onChange={e => onChange({ capability_statement: e.target.value })}
          placeholder="e.g. We primarily pursue federal building construction and MEP work on military and VA installations..."
          style={{ ...INPUT_STYLE, resize: 'vertical' as const, lineHeight: 1.5 }}
        />
      </FieldGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — Review
// ---------------------------------------------------------------------------

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em', flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0F172A', textAlign: 'right' as const }}>{value || <span style={{ color: '#94A3B8' }}>—</span>}</span>
    </div>
  )
}

function ReviewSection({ title, stepNum, onEdit, children }: { title: string; stepNum: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</span>
        <button
          type="button"
          onClick={() => onEdit(stepNum)}
          style={{ fontSize: 12, color: '#2F80FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function formatMoney(n: number | null | undefined): string {
  if (n == null) return ''
  return '$' + n.toLocaleString('en-US')
}

function Step5({ data, onEdit }: { data: WizardData; onEdit: (s: number) => void }) {
  const certList = (data.certifications ?? []).join(', ')
  const naicsDisplay = data.naics_codes_raw || (data.naics_codes ?? []).join(', ')
  const primaryStateLabel = US_STATES.find(s => s.value === data.primary_state)?.label ?? data.primary_state
  const geoStateLabels = (data.geographic_states ?? [])
    .map(v => US_STATES.find(s => s.value === v)?.label ?? v)
    .join(', ')
  const ctypeLabels = (data.construction_types ?? [])
    .map(v => CONSTRUCTION_TYPE_OPTIONS.find(o => o.value === v)?.label ?? v)
    .join(', ')

  return (
    <div>
      <ReviewSection title="Company Basics" stepNum={1} onEdit={onEdit}>
        <ReviewRow label="Company Name" value={data.company_name} />
        <ReviewRow label="UEI / CAGE" value={data.uei_cage} />
        <ReviewRow label="Years in Business" value={data.years_in_business != null ? String(data.years_in_business) : null} />
        <ReviewRow label="Employees" value={data.employee_count != null ? String(data.employee_count) : null} />
        <ReviewRow label="SAM.gov" value={data.sam_gov_registered ? 'Registered' : 'Not registered'} />
        <ReviewRow label="SBA Size" value={data.sba_size_category === 'small' ? 'Small' : data.sba_size_category === 'other_than_small' ? 'Other Than Small' : null} />
      </ReviewSection>

      <ReviewSection title="Certifications & NAICS" stepNum={2} onEdit={onEdit}>
        <ReviewRow label="Certifications" value={certList || null} />
        <ReviewRow label="NAICS Codes" value={naicsDisplay || null} />
      </ReviewSection>

      <ReviewSection title="Capacity & Bonding" stepNum={3} onEdit={onEdit}>
        <ReviewRow label="Annual Revenue" value={formatMoney(data.annual_revenue_usd)} />
        <ReviewRow label="Max Project Size" value={formatMoney(data.max_project_size_usd)} />
        <ReviewRow label="Single Bond Limit" value={formatMoney(data.bonding_single_usd)} />
        <ReviewRow label="Aggregate Bond" value={formatMoney(data.bonding_aggregate_usd)} />
        <ReviewRow label="Surety Company" value={data.surety_company} />
        <ReviewRow label="Construction Types" value={ctypeLabels || null} />
      </ReviewSection>

      <ReviewSection title="Geographic Coverage" stepNum={4} onEdit={onEdit}>
        <ReviewRow label="Primary State" value={primaryStateLabel} />
        <ReviewRow label="Work States" value={geoStateLabels || null} />
        <ReviewRow label="Federal Work Focus" value={data.capability_statement} />
      </ReviewSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    certifications: [],
    naics_codes: [],
    construction_types: [],
    geographic_states: [],
    sam_gov_registered: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function merge(patch: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    if (step === 1) return !!(data.company_name?.trim())
    return true
  }

  function next() {
    if (step < 5) setStep(s => s + 1)
  }

  function back() {
    if (step > 1) setStep(s => s - 1)
  }

  function jumpTo(s: number) {
    setStep(s)
  }

  // Parse raw NAICS string into array before submitting
  function resolveNaics(): string[] {
    const raw = data.naics_codes_raw ?? (data.naics_codes ?? []).join(', ')
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{6}$/.test(s))
  }

  async function handleComplete() {
    setSubmitting(true)
    setError(null)
    const payload: Partial<ProfileFormData> = {
      ...data,
      naics_codes: resolveNaics(),
    }
    // Remove wizard-only field
    delete (payload as WizardData).naics_codes_raw

    const result = await completeOnboarding(payload)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Header */}
        <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0B1220', letterSpacing: '-0.03em', marginBottom: 6 }}>
            Avero GovTool
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
            Set up your contractor profile
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            This helps us match you to the right federal opportunities.
          </div>
        </div>

        {/* Progress */}
        <ProgressBar step={step} />

        {/* Step card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '28px 32px', marginBottom: 20 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2F80FF', textTransform: 'uppercase' as const, letterSpacing: '0.10em', marginBottom: 4 }}>
              Step {step} of 5
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {step === 1 && 'Company Basics'}
              {step === 2 && 'Certifications & NAICS Codes'}
              {step === 3 && 'Capacity & Bonding'}
              {step === 4 && 'Geographic Coverage'}
              {step === 5 && 'Review & Complete'}
            </h2>
          </div>

          {step === 1 && <Step1 data={data} onChange={merge} />}
          {step === 2 && <Step2 data={data} onChange={merge} />}
          {step === 3 && <Step3 data={data} onChange={merge} />}
          {step === 4 && <Step4 data={data} onChange={merge} />}
          {step === 5 && <Step5 data={data} onEdit={jumpTo} />}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#E11D48' }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Back */}
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  padding: '9px 20px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            ) : (
              <div />
            )}
          </div>

          {/* Right side: skip + next/complete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {step < 5 && step > 1 && (
              <button
                type="button"
                onClick={next}
                style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Skip for now
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canAdvance()}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: canAdvance() ? '#2F80FF' : '#CBD5E1',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 24px',
                  cursor: canAdvance() ? 'pointer' : 'not-allowed',
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={submitting}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: submitting ? '#CBD5E1' : '#2F80FF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 28px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
