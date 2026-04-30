import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { getContract } from '@/lib/contracts/queries'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { DeliverableRow } from '@/components/contracts/DeliverableRow'
import { fmtContractValue, daysUntil, deriveStatus } from '@/lib/contracts/types'
import { updateDeliverableStatus, addDeliverable, completeContract } from './actions'
import { Edit, Plus } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const contract = await getContract(id)
  if (!contract) notFound()

  const status = deriveStatus(contract)
  const days = daysUntil(contract.period_end)
  const deliverables = contract.contract_deliverables ?? []
  const pendingCount = deliverables.filter(d => d.status === 'pending' || d.status === 'overdue').length

  const onUpdateDeliverable = async (deliverableId: string, newStatus: Parameters<typeof updateDeliverableStatus>[1]) => {
    'use server'
    await updateDeliverableStatus(deliverableId, newStatus)
  }

  return (
    <div style={{ maxWidth: 900, paddingBottom: 40 }}>
      <Link href="/contracts" style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.5)', textDecoration: 'none', display: 'block', marginBottom: 16 }}>
        \u2190 Contracts
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: '0 0 6px', textTransform: 'uppercase' }}>
            {contract.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ContractStatusBadge status={status} />
            {contract.contract_number && (
              <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)' }}>{contract.contract_number}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href={`/contracts/${id}/edit`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'rgba(192,194,198,0.08)', color: '#C0C2C6', fontSize: 10, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, borderRadius: 8, textDecoration: 'none', letterSpacing: '0.06em', border: '1px solid rgba(192,194,198,0.12)' }}>
            <Edit size={12} /> Edit
          </Link>
          {status === 'active' && (
            <form action={completeContract.bind(null, id)}>
              <button type="submit" style={{ padding: '8px 14px', background: 'rgba(0,196,140,0.15)', color: '#00C48C', fontSize: 10, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, borderRadius: 8, border: '1px solid rgba(0,196,140,0.3)', cursor: 'pointer', letterSpacing: '0.06em' }}>
                Mark Complete
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Base Value', value: fmtContractValue(contract.base_value), color: '#D4AF37' },
          { label: 'Ceiling Value', value: fmtContractValue(contract.ceiling_value), color: '#C0C2C6' },
          { label: 'Days Remaining', value: days !== null ? (days >= 0 ? `${days}d` : 'Expired') : '\u2014', color: days !== null && days <= 30 ? '#FF4D4F' : days !== null && days <= 90 ? '#F59E0B' : '#00C48C' },
          { label: 'Open Deliverables', value: String(pendingCount), color: pendingCount > 0 ? '#F59E0B' : '#00C48C' },
        ].map(stat => (
          <GlassPanel key={stat.label} style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: stat.color, lineHeight: 1 }}>{stat.value}</div>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {([
            ['Agency', contract.agency],
            ['CO Name', contract.contracting_officer_name],
            ['CO Email', contract.contracting_officer_email],
            ['CO Phone', contract.co_phone],
            ['Place of Performance', contract.place_of_performance],
            ['NAICS', contract.naics_code],
            ['Set-Aside', contract.set_aside],
            ['Period Start', contract.period_start],
            ['Period End', contract.period_end],
            ['Period End w/ Options', contract.period_end_with_options],
            ['Award Date', contract.award_date],
            ['Source Proposal', contract.proposal_id ? 'Linked' : null],
          ] as [string, string | null][]).map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 8, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: value ? '#F5F5F7' : 'rgba(192,194,198,0.3)' }}>
                {label === 'Source Proposal' && contract.proposal_id
                  ? <Link href={`/proposals/${contract.proposal_id}`} style={{ color: '#2F80FF', textDecoration: 'none' }}>View proposal</Link>
                  : (value ?? '\u2014')}
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel noPad>
        <div style={{ padding: '13px 20px', borderBottom: '1px solid rgba(192,194,198,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Deliverables
          </span>
          <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)' }}>
            {deliverables.length} total \u00b7 {pendingCount} open
          </span>
        </div>

        {deliverables.map(d => (
          <DeliverableRow key={d.id} deliverable={d} onUpdate={onUpdateDeliverable} />
        ))}

        <form action={addDeliverable.bind(null, id)} style={{ padding: '14px 20px', borderTop: '1px solid rgba(192,194,198,0.06)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <input name="title" placeholder="New deliverable title" required style={{ width: '100%', background: 'rgba(11,11,13,0.6)', border: '1px solid rgba(192,194,198,0.18)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ flex: 1 }}>
            <input name="due_date" type="date" style={{ width: '100%', background: 'rgba(11,11,13,0.6)', border: '1px solid rgba(192,194,198,0.18)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ flex: 1 }}>
            <select name="frequency" style={{ width: '100%', background: 'rgba(11,11,13,0.6)', border: '1px solid rgba(192,194,198,0.18)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7', boxSizing: 'border-box' as const }}>
              <option value="oneshot">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#2F80FF', color: '#fff', fontSize: 10, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', flexShrink: 0, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const }}>
            <Plus size={11} /> Add
          </button>
        </form>
      </GlassPanel>

      {contract.notes && (
        <GlassPanel style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 8, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: '#C0C2C6', marginBottom: 8 }}>Notes</div>
          <p style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', lineHeight: 1.6, margin: 0 }}>{contract.notes}</p>
        </GlassPanel>
      )}
    </div>
  )
}
