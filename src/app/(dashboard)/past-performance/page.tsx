import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { Award, Plus } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#C0C2C6',
}

const cparsColors: Record<string, string> = {
  Exceptional: '#00C48C',
  'Very Good': '#2F80FF',
  Satisfactory: '#C0C2C6',
  Marginal: '#F59E0B',
  Unsatisfactory: '#FF4D4F',
}

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
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', marginBottom: 8 }}>Past Performance</h1>
        <GlassPanel variant="accent" style={{ padding: 16, fontSize: 13, color: '#FF4D4F' }}>
          Failed to load records: {error.message}
        </GlassPanel>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
            Past Performance
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.55)', marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
            {rows?.length ?? 0} records
          </p>
        </div>
        <Link href="/past-performance/new" style={{
          background: '#FF1A1A',
          color: '#fff',
          borderRadius: 8,
          padding: '9px 18px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Oxanium', sans-serif",
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          letterSpacing: '0.06em',
        }}>
          <Plus size={14} strokeWidth={2} />ADD RECORD
        </Link>
      </div>

      {/* Table */}
      <GlassPanel noPad>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px 110px 140px',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(192,194,198,0.08)',
        }}>
          <span style={SECTION_LABEL}>Project</span>
          <span style={SECTION_LABEL}>Customer</span>
          <span style={SECTION_LABEL}>NAICS</span>
          <span style={SECTION_LABEL}>CPARS</span>
        </div>

        {(rows ?? []).map((pp) => {
          const cparsColor = cparsColors[pp.cpars_rating ?? ''] ?? 'rgba(192,194,198,0.45)'
          const naics = Array.isArray(pp.naics_codes) ? pp.naics_codes[0] : pp.naics_codes
          return (
            <Link
              key={pp.id}
              href={`/past-performance/${pp.id}`}
              className="glass-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px 110px 140px',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(192,194,198,0.06)',
                textDecoration: 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {pp.contract_title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(192,194,198,0.5)', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {pp.contract_value_usd ? `$${(Number(pp.contract_value_usd) / 1_000_000).toFixed(1)}M` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#C0C2C6' }}>{pp.customer_name ?? '—'}</span>
              <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.5)', fontFamily: "'IBM Plex Mono', monospace" }}>{naics ?? '—'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cparsColor, fontFamily: "'IBM Plex Mono', monospace" }}>{pp.cpars_rating ?? '—'}</span>
            </Link>
          )
        })}

        {(!rows || rows.length === 0) && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <Award size={36} strokeWidth={1} style={{ color: 'rgba(192,194,198,0.2)', margin: '0 auto 14px', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.55)' }}>
              No past performance records.{' '}
              <Link href="/past-performance/new" style={{ color: '#FF1A1A' }}>Add your first →</Link>
            </p>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
