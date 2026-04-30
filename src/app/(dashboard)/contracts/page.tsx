import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { getContracts } from '@/lib/contracts/queries'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { fmtContractValue, daysUntil, deriveStatus } from '@/lib/contracts/types'
import { Plus, FileText } from 'lucide-react'

export const metadata = { title: 'Contracts \u2014 GovTool' }

export default async function ContractsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const contracts = await getContracts()

  const totalValue = contracts.reduce((sum, c) => sum + (c.base_value ?? 0), 0)
  const active = contracts.filter(c => deriveStatus(c) === 'active').length
  const expiring = contracts.filter(c => deriveStatus(c) === 'expiring').length

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 20, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.5)' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Contract Cloud
            </h1>
          </div>
          <p style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', paddingLeft: 13, margin: 0, letterSpacing: '0.06em' }}>
            {contracts.length} contract{contracts.length !== 1 ? 's' : ''} \u00b7 {fmtContractValue(totalValue)} total base value
          </p>
        </div>
        <Link href="/contracts/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 18px', background: '#FF1A1A', color: '#fff',
          fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.06em', borderRadius: 8, textDecoration: 'none',
        }}>
          <Plus size={13} strokeWidth={2.5} /> New Contract
        </Link>
      </div>

      {contracts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Base Value', value: fmtContractValue(totalValue), color: '#D4AF37' },
            { label: 'Active', value: String(active), color: '#00C48C' },
            { label: 'Expiring \u226490 days', value: String(expiring), color: expiring > 0 ? '#F59E0B' : '#C0C2C6' },
          ].map(stat => (
            <GlassPanel key={stat.label} style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {contracts.length === 0 ? (
        <GlassPanel style={{ padding: '48px 24px', textAlign: 'center' as const }}>
          <FileText size={28} color="rgba(192,194,198,0.3)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, fontFamily: "'Oxanium', sans-serif", fontWeight: 600, color: '#C0C2C6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            No contracts yet
          </div>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', marginBottom: 16 }}>
            Mark a proposal as Won to convert it to a contract, or create one manually.
          </div>
          <Link href="/contracts/new" style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#FF1A1A', textDecoration: 'none', letterSpacing: '0.06em' }}>
            + Add first contract
          </Link>
        </GlassPanel>
      ) : (
        <GlassPanel noPad>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(192,194,198,0.08)', display: 'flex', gap: 0 }}>
            {['Contract', 'Agency', 'Value', 'Period End', 'Status'].map(col => (
              <div key={col} style={{ flex: col === 'Contract' ? 3 : 1, fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {col}
              </div>
            ))}
          </div>
          {contracts.map((contract, i) => {
            const status = deriveStatus(contract)
            const days = daysUntil(contract.period_end)
            return (
              <Link key={contract.id} href={`/contracts/${contract.id}`} style={{ display: 'flex', gap: 0, padding: '14px 20px', textDecoration: 'none', borderBottom: i < contracts.length - 1 ? '1px solid rgba(192,194,198,0.06)' : 'none', background: i % 2 === 0 ? 'rgba(26,29,33,0.3)' : 'transparent' }}>
                <div style={{ flex: 3, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F5F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{contract.title}</div>
                  {contract.contract_number && <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', marginTop: 2 }}>{contract.contract_number}</div>}
                </div>
                <div style={{ flex: 1, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', alignSelf: 'center' }}>{contract.agency ?? '\u2014'}</div>
                <div style={{ flex: 1, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', fontWeight: 700, alignSelf: 'center' }}>{fmtContractValue(contract.base_value)}</div>
                <div style={{ flex: 1, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: days !== null && days <= 30 ? '#F59E0B' : '#C0C2C6', alignSelf: 'center' }}>
                  {contract.period_end ?? '\u2014'}
                  {days !== null && days >= 0 && days <= 90 && <span style={{ fontSize: 9, marginLeft: 6, color: '#F59E0B' }}>({days}d)</span>}
                </div>
                <div style={{ flex: 1, alignSelf: 'center' }}>
                  <ContractStatusBadge status={status} />
                </div>
              </Link>
            )
          })}
        </GlassPanel>
      )}
    </div>
  )
}
