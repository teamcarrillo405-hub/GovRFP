import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import WageInputForm from './WageInputForm'
import WageChecklist from './WageChecklist'

interface Props {
  params: Promise<{ id: string }>
}

// Davis-Bacon detection helpers
interface DetectionResult {
  detected: boolean
  signals: string[]
}

function detectDavisBacon(rfpText: string | null | undefined): DetectionResult {
  if (!rfpText) return { detected: false, signals: [] }

  const text = rfpText.toLowerCase()
  const signals: string[] = []

  if (text.includes('davis-bacon') || text.includes('davis bacon')) {
    signals.push('Davis-Bacon clause found')
  }
  if (text.includes('wage determination')) {
    signals.push('Wage determination reference found')
  }
  if (rfpText.includes('WD-')) {
    signals.push('Wage determination number prefix (WD-) found')
  }
  if (rfpText.includes('FAR 52.222-6') || rfpText.includes('FAR 52.222')) {
    signals.push('FAR 52.222 (Davis-Bacon) clause reference found')
  }

  return { detected: signals.length > 0, signals }
}

const TRADES_TABLE = [
  { trade: 'Carpenter', classification: 'Journey', notes: 'Includes formwork, finish' },
  { trade: 'Cement Mason', classification: 'Journey', notes: 'Flatwork, stucco' },
  { trade: 'Electrician', classification: 'Journey', notes: 'Inside wireman' },
  { trade: 'Ironworker', classification: 'Journey', notes: 'Structural, reinforcing' },
  { trade: 'Laborer', classification: 'Journey', notes: 'General, concrete' },
  { trade: 'Operating Engineer', classification: 'Journey', notes: 'Equipment operator' },
  { trade: 'Painter', classification: 'Journey', notes: 'Brush, roller, spray' },
  { trade: 'Plumber', classification: 'Journey', notes: 'Pipefitter' },
]

const cardStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '24px 28px',
  marginBottom: 20,
}

const sectionTitleStyle = {
  fontSize: 15,
  fontWeight: 700,
  color: '#0F172A',
  marginBottom: 6,
}

const sectionSubtitleStyle = {
  fontSize: 13,
  color: '#64748B',
  marginBottom: 20,
}

export default async function PrevailingWagePage({ params }: Props) {
  const { id } = await params

  // Auth guard
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Load proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, rfp_text')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  // Role check
  const role = await requireProposalRole(id, 'viewer')
  if (!role) notFound()

  // Wage inputs — graceful fallback
  let wageInputs: {
    state: string
    county: string
    construction_type: string
    wd_number: string
    notes: string
  } | null = null

  try {
    const { data } = await (supabase as any)
      .from('prevailing_wage_inputs')
      .select('*')
      .eq('proposal_id', id)
      .maybeSingle()

    wageInputs = data ?? null
  } catch {
    wageInputs = null
  }

  // Davis-Bacon detection
  const detection = detectDavisBacon(proposal.rfp_text)

  // Determine detection status
  let detectionStatus: 'detected' | 'not-detected' | 'no-rfp'
  if (!proposal.rfp_text) {
    detectionStatus = 'no-rfp'
  } else if (detection.detected) {
    detectionStatus = 'detected'
  } else {
    detectionStatus = 'not-detected'
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/proposals/${id}/editor`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748B', textDecoration: 'none', marginBottom: 14 }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {proposal.title}
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
          Prevailing Wage Compliance
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
          Davis-Bacon Act wage determination and compliance tracking
        </p>
      </div>

      {/* Section 1: Davis-Bacon Detection */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Davis-Bacon Detection</div>
        <div style={sectionSubtitleStyle}>Automatic scan of RFP text for Davis-Bacon indicators</div>

        {detectionStatus === 'detected' && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#00C48C',
                background: '#00C48C14',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Davis-Bacon requirements detected in this RFP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {detection.signals.map(signal => (
                <div key={signal} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ color: '#00C48C', fontWeight: 700, fontSize: 15 }}>&#10003;</span>
                  <span style={{ color: '#0F172A' }}>{signal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detectionStatus === 'not-detected' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#F59E0B',
              background: '#F59E0B14',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Davis-Bacon not detected — verify if applicable
          </div>
        )}

        {detectionStatus === 'no-rfp' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#94A3B8',
              background: '#94A3B814',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upload RFP to check automatically
          </div>
        )}
      </div>

      {/* Section 2: Wage Determination Lookup */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Wage Determination Reference</div>
        <div style={sectionSubtitleStyle}>
          Enter wage determination details for this proposal
        </div>
        <WageInputForm
          proposalId={id}
          initialValues={wageInputs}
        />
      </div>

      {/* Section 3: Compliance Checklist */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Wage Compliance Checklist</div>
        <div style={sectionSubtitleStyle}>
          Track Davis-Bacon compliance requirements across proposal phases
        </div>
        <WageChecklist />
      </div>

      {/* Section 4: Common Trades Reference */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Common Trade Classifications</div>
        <div style={sectionSubtitleStyle}>
          Standard Davis-Bacon construction trade classifications
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: '#0F172A', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trade</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: '#0F172A', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Classification</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: '#0F172A', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {TRADES_TABLE.map((row, idx) => (
              <tr
                key={row.trade}
                style={{ borderBottom: idx < TRADES_TABLE.length - 1 ? '1px solid #F0F2F5' : 'none' }}
              >
                <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: 600 }}>{row.trade}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{row.classification}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
