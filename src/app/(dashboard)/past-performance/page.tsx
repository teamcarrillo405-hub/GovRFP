import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { Award, Star, Plus } from 'lucide-react'

export default async function PastPerformanceListPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('past_performance')
    .select(
      'id, contract_title, contract_number, customer_name, customer_agency_code, period_start, period_end, contract_value_usd, naics_codes, set_asides_claimed, cpars_rating, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Past Performance</h1>
        <div style={{ borderRadius: 8, border: '1px solid #FF4D4F', background: '#fff0f0', padding: 16, fontSize: 13, color: '#FF4D4F' }}>
          Failed to load records: {error.message}
        </div>
      </div>
    )
  }

  const cparsColors: Record<string, string> = {
    Exceptional: '#00C48C',
    'Very Good': '#2F80FF',
    Satisfactory: '#475569',
    Marginal: '#F59E0B',
    Unsatisfactory: '#FF4D4F',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>Past Performance</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{rows?.length ?? 0} records</p>
        </div>
        <Link href="/past-performance/new" style={{ background: '#2F80FF', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} strokeWidth={1.5} />Add Record
        </Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 130px', padding: '10px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569' }}>
          <span>Project</span><span>Customer</span><span>NAICS</span><span>CPARS</span>
        </div>

        {(rows ?? []).map((pp) => {
          const cparsColor = cparsColors[pp.cpars_rating ?? ''] ?? '#94A3B8'
          const naics = Array.isArray(pp.naics_codes) ? pp.naics_codes[0] : pp.naics_codes
          return (
            <Link
              key={pp.id}
              href={`/past-performance/${pp.id}`}
              style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 130px', padding: '13px 20px', borderBottom: '1px solid #F8FAFC', textDecoration: 'none', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{pp.contract_title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  {pp.contract_value_usd ? `$${(Number(pp.contract_value_usd) / 1_000_000).toFixed(1)}M` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#475569' }}>{pp.customer_name ?? '—'}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>{naics ?? '—'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cparsColor }}>{pp.cpars_rating ?? '—'}</span>
            </Link>
          )
        })}

        {(!rows || rows.length === 0) && (
          <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
            <Award size={32} strokeWidth={1} style={{ color: '#E2E8F0', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 13, color: '#475569' }}>
              No past performance records.{' '}
              <Link href="/past-performance/new" style={{ color: '#2F80FF' }}>Add your first →</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
