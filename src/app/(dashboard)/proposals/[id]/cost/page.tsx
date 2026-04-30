import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { addCostItem, deleteCostItem, saveCostSettings } from './actions'
import CostNarrativeButton from '@/components/proposals/CostNarrativeButton'

interface Props {
  params: Promise<{ id: string }>
}

interface CostItem {
  id: string
  labor_category: string
  cost_type: string
  rate_per_hour: number
  hours: number
  period_of_performance: string | null
  notes: string | null
  sort_order: number
}

interface CostSettings {
  fee_pct: number
  overhead_rate: number
  g_and_a_rate: number
}

const GLASS: React.CSSProperties = {
  background: 'rgba(26,29,33,0.72)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(192,194,198,0.1)',
  borderRadius: 10,
}

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(11,11,13,0.6)',
  border: '1px solid rgba(192,194,198,0.15)',
  borderRadius: 6,
  color: '#C0C2C6',
  fontSize: 12,
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'Space Grotesk', sans-serif",
}

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(192,194,198,0.45)',
  display: 'block',
  marginBottom: 4,
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(192,194,198,0.45)',
  marginBottom: 12,
  paddingLeft: 4,
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function costTypeLabel(t: string): string {
  if (t === 'indirect') return 'Indirect'
  if (t === 'fee') return 'Fee'
  return 'Direct'
}

function costTypeColor(t: string): string {
  if (t === 'indirect') return '#F59E0B'
  if (t === 'fee') return '#2F80FF'
  return '#00C48C'
}

export default async function CostPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Load proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  // Load cost items
  let costItems: CostItem[] = []
  try {
    const { data } = await supabase
      .from('proposal_cost_items' as any)
      .select('id, labor_category, cost_type, rate_per_hour, hours, period_of_performance, notes, sort_order')
      .eq('proposal_id', id)
      .order('sort_order', { ascending: true })
    costItems = (data ?? []) as CostItem[]
  } catch {
    costItems = []
  }

  // Load cost settings (or defaults)
  let settings: CostSettings = { fee_pct: 10, overhead_rate: 0, g_and_a_rate: 0 }
  try {
    const { data } = await supabase
      .from('proposal_cost_settings' as any)
      .select('fee_pct, overhead_rate, g_and_a_rate')
      .eq('proposal_id', id)
      .maybeSingle()
    if (data) {
      settings = data as CostSettings
    }
  } catch {
    // use defaults
  }

  // Compute totals
  const directItems = costItems.filter((i) => i.cost_type === 'direct')
  const directTotal = directItems.reduce((sum, i) => sum + i.rate_per_hour * i.hours, 0)
  const overheadTotal = directTotal * (settings.overhead_rate / 100)
  const gAndATotal = (directTotal + overheadTotal) * (settings.g_and_a_rate / 100)
  const feeTotal = (directTotal + overheadTotal + gAndATotal) * (settings.fee_pct / 100)
  const grandTotal = directTotal + overheadTotal + gAndATotal + feeTotal

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/proposals/${id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'rgba(192,194,198,0.45)', textDecoration: 'none', fontSize: 12 }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />{proposal.title}
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', margin: 0 }}>
          Cost Proposal
        </h1>
        <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.45)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4, marginBottom: 0 }}>
          FAR 15.408 compliant cost breakdown
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ ...GLASS, padding: '16px 28px', display: 'flex', gap: 44, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatPill label="Direct Labor" value={`$${fmt(directTotal)}`} color="#00C48C" />
        <StatPill label="Overhead" value={`$${fmt(overheadTotal)}`} color="#F59E0B" />
        <StatPill label="Fee / Profit" value={`$${fmt(feeTotal)}`} color="#2F80FF" />
        <StatPill label="Grand Total" value={`$${fmt(grandTotal)}`} color="#FF1A1A" />
      </div>

      {/* Labor Categories Table */}
      <div style={{ marginBottom: 8 }}>
        <div style={SECTION_TITLE}>Labor Categories</div>
      </div>
      <div style={{ ...GLASS, overflow: 'hidden', marginBottom: 24 }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px 110px 1fr 60px', padding: '8px 16px', borderBottom: '1px solid rgba(192,194,198,0.08)', background: 'rgba(11,11,13,0.3)' }}>
          {['Labor Category', 'Cost Type', 'Rate/Hr', 'Hours', 'Total', 'Period / Notes', ''].map((col) => (
            <div
              key={col}
              style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.4)', padding: '0 8px' }}
            >
              {col}
            </div>
          ))}
        </div>

        {costItems.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', fontSize: 12, color: 'rgba(192,194,198,0.35)', fontFamily: "'IBM Plex Mono', monospace" }}>
            No labor categories added yet. Use the form below to add your first row.
          </div>
        ) : (
          costItems.map((item, idx) => {
            const lineTotal = item.rate_per_hour * item.hours
            return (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 100px 90px 110px 1fr 60px',
                  padding: '10px 16px',
                  borderBottom: idx < costItems.length - 1 ? '1px solid rgba(192,194,198,0.06)' : 'none',
                  alignItems: 'center',
                }}
              >
                <div style={{ padding: '0 8px', fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {item.labor_category}
                </div>
                <div style={{ padding: '0 8px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em',
                    color: costTypeColor(item.cost_type),
                    background: costTypeColor(item.cost_type) + '14',
                    padding: '2px 7px', borderRadius: 4,
                  }}>
                    {costTypeLabel(item.cost_type)}
                  </span>
                </div>
                <div style={{ padding: '0 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#C0C2C6' }}>
                  ${fmt(item.rate_per_hour)}
                </div>
                <div style={{ padding: '0 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#C0C2C6' }}>
                  {item.hours}
                </div>
                <div style={{ padding: '0 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: '#F5F5F7' }}>
                  ${fmt(lineTotal)}
                </div>
                <div style={{ padding: '0 8px', fontSize: 11, color: 'rgba(192,194,198,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[item.period_of_performance, item.notes].filter(Boolean).join(' · ') || '—'}
                </div>
                <div style={{ padding: '0 8px' }}>
                  <form
                    action={async () => {
                      'use server'
                      await deleteCostItem(item.id, id)
                    }}
                  >
                    <button
                      type="submit"
                      style={{ background: 'none', border: 'none', color: 'rgba(192,194,198,0.35)', fontSize: 14, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                      title="Delete row"
                    >
                      ×
                    </button>
                  </form>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Cost Summary */}
      <div style={{ marginBottom: 8 }}>
        <div style={SECTION_TITLE}>Cost Summary</div>
      </div>
      <div style={{ ...GLASS, overflow: 'hidden', marginBottom: 24 }}>
        {[
          { label: 'Direct Labor Total', value: directTotal, color: '#C0C2C6', bold: false, highlight: false },
          { label: `Overhead (${settings.overhead_rate}%)`, value: overheadTotal, color: '#F59E0B', bold: false, highlight: false },
          { label: `G&A (${settings.g_and_a_rate}%)`, value: gAndATotal, color: '#C0C2C6', bold: false, highlight: false },
          { label: `Fee / Profit (${settings.fee_pct}%)`, value: feeTotal, color: '#2F80FF', bold: false, highlight: false },
        ].map((row) => (
          <div
            key={row.label}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(192,194,198,0.06)' }}
          >
            <span style={{ fontSize: 13, color: 'rgba(192,194,198,0.7)', fontFamily: "'Space Grotesk', sans-serif" }}>{row.label}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: row.color }}>${fmt(row.value)}</span>
          </div>
        ))}
        {/* Grand Total row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(255,26,26,0.06)' }}>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#FF1A1A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total Proposed Cost
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 900, color: '#FF1A1A' }}>${fmt(grandTotal)}</span>
        </div>
      </div>

      {/* Add Labor Category form */}
      <div style={{ marginBottom: 8 }}>
        <div style={SECTION_TITLE}>Add Labor Category</div>
      </div>
      <div style={{ ...GLASS, padding: 20, marginBottom: 24 }}>
        <form
          action={async (formData: FormData) => {
            'use server'
            await addCostItem(id, formData)
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Labor Category *</label>
              <input
                type="text"
                name="labor_category"
                placeholder="e.g. Senior Engineer"
                required
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Cost Type</label>
              <select name="cost_type" defaultValue="direct" style={SELECT_STYLE}>
                <option value="direct">Direct</option>
                <option value="indirect">Indirect</option>
                <option value="fee">Fee</option>
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Rate / Hr ($)</label>
              <input
                type="number"
                name="rate_per_hour"
                placeholder="0.00"
                min="0"
                step="0.01"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Hours</label>
              <input
                type="number"
                name="hours"
                placeholder="0"
                min="0"
                step="0.5"
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Period of Performance</label>
              <input
                type="text"
                name="period_of_performance"
                placeholder="e.g. Base Year (12 months)"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Notes</label>
              <input
                type="text"
                name="notes"
                placeholder="Optional justification notes"
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <button
            type="submit"
            style={{ padding: '9px 22px', background: 'rgba(0,196,140,0.12)', border: '1px solid rgba(0,196,140,0.3)', borderRadius: 8, color: '#00C48C', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            + Add Row
          </button>
        </form>
      </div>

      {/* Settings form */}
      <div style={{ marginBottom: 8 }}>
        <div style={SECTION_TITLE}>Cost Settings</div>
      </div>
      <div style={{ ...GLASS, padding: 20, marginBottom: 24 }}>
        <form
          action={async (formData: FormData) => {
            'use server'
            await saveCostSettings(id, formData)
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Fee / Profit %</label>
              <input
                type="number"
                name="fee_pct"
                defaultValue={settings.fee_pct}
                min="0"
                max="100"
                step="0.1"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Overhead Rate %</label>
              <input
                type="number"
                name="overhead_rate"
                defaultValue={settings.overhead_rate}
                min="0"
                max="999"
                step="0.1"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>G&amp;A Rate %</label>
              <input
                type="number"
                name="g_and_a_rate"
                defaultValue={settings.g_and_a_rate}
                min="0"
                max="999"
                step="0.1"
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <button
            type="submit"
            style={{ padding: '9px 22px', background: 'rgba(47,128,255,0.12)', border: '1px solid rgba(47,128,255,0.3)', borderRadius: 8, color: '#2F80FF', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            Save Settings
          </button>
        </form>
      </div>

      {/* Generate Cost Narrative */}
      <div style={{ marginBottom: 8 }}>
        <div style={SECTION_TITLE}>Cost Narrative</div>
      </div>
      <div style={{ ...GLASS, padding: 20, marginBottom: 32 }}>
        <CostNarrativeButton proposalId={id} />
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)' }}>{label}</span>
    </div>
  )
}
