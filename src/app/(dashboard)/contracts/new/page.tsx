import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { createContract } from './actions'
import type React from 'react'

export const metadata = { title: 'New Contract \u2014 GovTool' }

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase',
  letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 6,
}
const INPUT: React.CSSProperties = {
  display: 'block', width: '100%', borderRadius: 8,
  padding: '10px 14px', fontSize: 12,
  fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7',
  background: 'rgba(11,11,13,0.6)',
  border: '1px solid rgba(192,194,198,0.18)',
  boxSizing: 'border-box' as const,
}

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ proposal_id?: string; title?: string; agency?: string; value?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  return (
    <div style={{ maxWidth: 720, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 3, height: 20, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.5)' }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
          New Contract
        </h1>
      </div>

      <form action={createContract}>
        {params.proposal_id && <input type="hidden" name="proposal_id" value={params.proposal_id} />}

        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 16 }}>Identity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Contract Title *</label>
              <input name="title" required defaultValue={params.title ?? ''} style={INPUT} placeholder="e.g. NAVFAC Vertical Construction IDIQ \u2014 Task Order 0012" />
            </div>
            <div>
              <label style={LABEL}>Contract Number</label>
              <input name="contract_number" style={INPUT} placeholder="N40085-26-D-0044" />
            </div>
            <div>
              <label style={LABEL}>Agency</label>
              <input name="agency" defaultValue={params.agency ?? ''} style={INPUT} placeholder="Department of the Navy" />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 16 }}>Contracting Officer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={LABEL}>CO Name</label><input name="contracting_officer_name" style={INPUT} /></div>
            <div><label style={LABEL}>CO Email</label><input name="contracting_officer_email" type="email" style={INPUT} /></div>
            <div><label style={LABEL}>CO Phone</label><input name="co_phone" type="tel" style={INPUT} /></div>
            <div><label style={LABEL}>Place of Performance</label><input name="place_of_performance" style={INPUT} placeholder="San Diego, CA" /></div>
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 16 }}>Value &amp; Period</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={LABEL}>Base Value ($)</label><input name="base_value" type="number" step="0.01" min="0" defaultValue={params.value ?? ''} style={INPUT} placeholder="1250000" /></div>
            <div><label style={LABEL}>Ceiling Value ($)</label><input name="ceiling_value" type="number" step="0.01" min="0" style={INPUT} placeholder="2500000" /></div>
            <div><label style={LABEL}>Award Date</label><input name="award_date" type="date" style={INPUT} /></div>
            <div><label style={LABEL}>Period Start</label><input name="period_start" type="date" style={INPUT} /></div>
            <div><label style={LABEL}>Base Period End</label><input name="period_end" type="date" style={INPUT} /></div>
            <div><label style={LABEL}>Period End w/ All Options</label><input name="period_end_with_options" type="date" style={INPUT} /></div>
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 16 }}>Classification</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={LABEL}>NAICS Code</label><input name="naics_code" style={INPUT} placeholder="236220" /></div>
            <div><label style={LABEL}>Set-Aside</label><input name="set_aside" style={INPUT} placeholder="SB / 8(a) / HUBZone / SDVOSB" /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Notes</label>
              <textarea name="notes" rows={3} style={{ ...INPUT, resize: 'vertical' as const }} />
            </div>
          </div>
        </GlassPanel>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" style={{
            padding: '11px 24px', background: '#FF1A1A', color: '#fff',
            fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.06em', borderRadius: 8, border: 'none', cursor: 'pointer',
          }}>
            Create Contract
          </button>
        </div>
      </form>
    </div>
  )
}
