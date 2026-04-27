'use client'

import { useState, useTransition } from 'react'
import { savePrevailingWageInputs } from './actions'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
]

const CONSTRUCTION_TYPES = ['Building', 'Heavy', 'Highway', 'Residential']

interface WageInputFormProps {
  proposalId: string
  initialValues: {
    state: string
    county: string
    construction_type: string
    wd_number: string
    notes: string
  } | null
}

export default function WageInputForm({ proposalId, initialValues }: WageInputFormProps) {
  const [state, setState] = useState(initialValues?.state ?? '')
  const [county, setCounty] = useState(initialValues?.county ?? '')
  const [constructionType, setConstructionType] = useState(initialValues?.construction_type ?? '')
  const [wdNumber, setWdNumber] = useState(initialValues?.wd_number ?? '')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    fontSize: 13,
    color: '#0F172A',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  }

  function handleSave() {
    startTransition(async () => {
      const result = await savePrevailingWageInputs(proposalId, {
        state,
        county,
        construction_type: constructionType,
        wd_number: wdNumber,
        notes,
      })
      setSaveStatus(result.success ? 'saved' : 'error')
      if (result.success) {
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* State */}
        <div>
          <label style={labelStyle}>State</label>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select state...</option>
            {US_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* County */}
        <div>
          <label style={labelStyle}>County</label>
          <input
            type="text"
            value={county}
            onChange={e => setCounty(e.target.value)}
            placeholder="e.g. Sacramento"
            style={inputStyle}
          />
        </div>

        {/* Construction Type */}
        <div>
          <label style={labelStyle}>Construction Type</label>
          <select
            value={constructionType}
            onChange={e => setConstructionType(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select type...</option>
            {CONSTRUCTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* WD Number */}
        <div>
          <label style={labelStyle}>WD Number</label>
          <input
            type="text"
            value={wdNumber}
            onChange={e => setWdNumber(e.target.value)}
            placeholder="e.g. CA20240001 mod 5"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional compliance notes..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>

      {/* Save button + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            background: '#2F80FF',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
        {saveStatus === 'saved' && (
          <span style={{ fontSize: 13, color: '#00C48C', fontWeight: 600 }}>Saved</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: 13, color: '#FF4D4F', fontWeight: 600 }}>Error saving — try again</span>
        )}
      </div>

      {/* SAM.gov link */}
      <div style={{ marginTop: 16 }}>
        <a
          href="https://sam.gov/content/wage-determinations"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2F80FF', fontSize: 13 }}
        >
          Search wage determinations on SAM.gov &rarr;
        </a>
      </div>
    </div>
  )
}
