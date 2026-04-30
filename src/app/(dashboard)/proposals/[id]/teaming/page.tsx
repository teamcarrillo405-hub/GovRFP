import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { addTeamingPartner, deleteTeamingPartner } from './actions'

interface Props {
  params: Promise<{ id: string }>
}

type PartnerRole = 'prime' | 'subcontractor' | 'mentor_protege' | 'joint_venture'
type Certification = 'WOSB' | 'SDVOSB' | '8a' | 'HUBZone' | 'SDB' | 'none'
type PartnerStatus = 'prospect' | 'contacted' | 'loi_signed' | 'declined'

interface TeamingPartner {
  id: string
  proposal_id: string
  company_name: string
  role: PartnerRole
  certification: Certification
  work_share_pct: number | null
  point_of_contact: string | null
  email: string | null
  notes: string | null
  status: PartnerStatus
  created_at: string
}

function roleLabel(role: PartnerRole): string {
  if (role === 'prime') return 'Prime'
  if (role === 'subcontractor') return 'Subcontractor'
  if (role === 'mentor_protege') return 'Mentor-Protege'
  if (role === 'joint_venture') return 'Joint Venture'
  return role
}

function certLabel(cert: Certification): string {
  if (cert === 'none') return '—'
  if (cert === '8a') return '8(a)'
  return cert
}

function statusColor(status: PartnerStatus): string {
  if (status === 'loi_signed') return '#00C48C'
  if (status === 'contacted') return '#F59E0B'
  if (status === 'declined') return '#FF4D4F'
  return '#94A3B8'
}

function statusLabel(status: PartnerStatus): string {
  if (status === 'loi_signed') return 'LOI Signed'
  if (status === 'contacted') return 'Contacted'
  if (status === 'declined') return 'Declined'
  return 'Prospect'
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  color: '#F5F5F7',
  border: '1px solid rgba(192,194,198,0.1)',
  borderRadius: 6,
  padding: '7px 10px',
  background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)',
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(192,194,198,0.55)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 4,
}

export default async function TeamingPage({ params }: Props) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  // Role gate
  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  // RFP analysis for set-aside context
  const { data: analysis } = await supabase
    .from('rfp_analysis')
    .select('naics_codes, set_aside_flags, set_asides_detected')
    .eq('proposal_id', id)
    .maybeSingle()

  // Teaming partners
  let partners: TeamingPartner[] = []
  try {
    const { data: partnerData } = await supabase
      .from('teaming_partners' as any)
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
    partners = (partnerData ?? []) as TeamingPartner[]
  } catch {
    partners = []
  }

  // Work share stats
  const totalWorkShare = partners.reduce((sum, p) => sum + (p.work_share_pct ?? 0), 0)
  const remaining = Math.max(0, 100 - totalWorkShare)
  const workShareOver = totalWorkShare > 100

  // Set-aside context
  const setAsidesDetected: string[] =
    Array.isArray(analysis?.set_asides_detected)
      ? (analysis.set_asides_detected as string[])
      : typeof analysis?.set_asides_detected === 'string' && analysis.set_asides_detected
      ? [analysis.set_asides_detected]
      : []

  const naicsCodes: string[] =
    Array.isArray(analysis?.naics_codes)
      ? (analysis.naics_codes as string[])
      : typeof analysis?.naics_codes === 'string' && analysis.naics_codes
      ? [analysis.naics_codes]
      : []

  const showSetAsideCard = setAsidesDetected.length > 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/proposals/${id}/editor`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'rgba(192,194,198,0.45)',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {proposal.title}
        </Link>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', margin: 0 }}>
          Teaming Partners
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.55)', marginTop: 4, marginBottom: 0 }}>
          Subcontractor and teaming partner management
        </p>
      </div>

      {/* Set-Aside Context Card */}
      {showSetAsideCard && (
        <div
          style={{
            background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,194,198,0.1)',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)', marginBottom: 10 }}>
            Set-Aside Requirements Detected
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {setAsidesDetected.map((sa) => (
              <span
                key={sa}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2F80FF',
                  background: '#2F80FF14',
                  padding: '3px 9px',
                  borderRadius: 4,
                }}
              >
                {sa}
              </span>
            ))}
            {naicsCodes.map((code) => (
              <span
                key={code}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'rgba(192,194,198,0.55)',
                  background: 'rgba(11,11,13,0.2)',
                  padding: '3px 9px',
                  borderRadius: 4,
                }}
              >
                NAICS {code}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.55)', margin: 0, lineHeight: 1.5 }}>
            This opportunity has set-aside requirements. Ensure teaming partners meet applicable SBA size standards and certifications.
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Partner table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(192,194,198,0.1)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 90px 80px 110px 60px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(192,194,198,0.08)',
                background: 'rgba(11,11,13,0.3)',
              }}
            >
              {['Company Name', 'Role', 'Certification', 'Work Share', 'Status', ''].map((col) => (
                <div
                  key={col}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'rgba(192,194,198,0.45)',
                    padding: '0 6px',
                  }}
                >
                  {col}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {partners.length === 0 && (
              <div
                style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  color: 'rgba(192,194,198,0.45)',
                  fontSize: 13,
                }}
              >
                No teaming partners added yet. Use the form to add your first partner.
              </div>
            )}

            {/* Rows */}
            {partners.map((partner, idx) => {
              const sc = statusColor(partner.status)
              return (
                <div
                  key={partner.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.8fr 1fr 90px 80px 110px 60px',
                    padding: '12px 16px',
                    borderBottom: idx < partners.length - 1 ? '1px solid #F1F5F9' : 'none',
                    alignItems: 'center',
                  }}
                >
                  {/* Company Name */}
                  <div style={{ padding: '0 6px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>
                      {partner.company_name}
                    </div>
                    {partner.point_of_contact && (
                      <div style={{ fontSize: 11, color: 'rgba(192,194,198,0.45)', marginTop: 1 }}>
                        {partner.point_of_contact}
                      </div>
                    )}
                  </div>

                  {/* Role */}
                  <div style={{ padding: '0 6px' }}>
                    <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)' }}>
                      {roleLabel(partner.role)}
                    </span>
                  </div>

                  {/* Certification */}
                  <div style={{ padding: '0 6px' }}>
                    {partner.certification !== 'none' ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#2F80FF',
                          background: '#2F80FF14',
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}
                      >
                        {certLabel(partner.certification)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                    )}
                  </div>

                  {/* Work Share */}
                  <div style={{ padding: '0 6px' }}>
                    {partner.work_share_pct != null ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#2F80FF' }}>
                        {partner.work_share_pct}%
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ padding: '0 6px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: sc,
                        background: sc + '14',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {statusLabel(partner.status)}
                    </span>
                  </div>

                  {/* Delete action */}
                  <div style={{ padding: '0 6px' }}>
                    <form
                      action={async () => {
                        'use server'
                        await deleteTeamingPartner(partner.id, id)
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          fontSize: 11,
                          color: 'rgba(192,194,198,0.45)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 4,
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Work Share Summary */}
          <div
            style={{
              background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(192,194,198,0.1)',
              borderRadius: 8,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(192,194,198,0.45)', marginBottom: 12 }}>
              Work Share Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(192,194,198,0.6)' }}>Total assigned to partners</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: workShareOver ? '#FF4D4F' : '#0F172A',
                }}
              >
                {totalWorkShare}%
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(192,194,198,0.6)' }}>Remaining for prime</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7' }}>{remaining}%</span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: 6,
                background: 'rgba(11,11,13,0.2)',
                borderRadius: 99,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(totalWorkShare, 100)}%`,
                  background: workShareOver ? '#FF4D4F' : '#2F80FF',
                  borderRadius: 99,
                  transition: 'width 0.3s',
                }}
              />
            </div>

            {workShareOver && (
              <p style={{ fontSize: 12, color: '#F59E0B', marginTop: 10, marginBottom: 0, fontWeight: 600 }}>
                Warning: total work share exceeds 100%. Review partner allocations.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Add Partner Form */}
        <div
          style={{
            background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,194,198,0.1)',
            borderRadius: 8,
            padding: '20px',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>
            Add Partner
          </div>

          <form
            action={async (formData: FormData) => {
              'use server'
              await addTeamingPartner(id, formData)
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {/* Company Name */}
            <div>
              <label style={LABEL_STYLE} htmlFor="company_name">Company Name</label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                placeholder="Acme Contractors Inc."
                style={INPUT_STYLE}
              />
            </div>

            {/* Role */}
            <div>
              <label style={LABEL_STYLE} htmlFor="role">Role</label>
              <select id="role" name="role" style={INPUT_STYLE}>
                <option value="subcontractor">Subcontractor</option>
                <option value="mentor_protege">Mentor-Protege</option>
                <option value="joint_venture">Joint Venture</option>
              </select>
            </div>

            {/* Certification */}
            <div>
              <label style={LABEL_STYLE} htmlFor="certification">Certification</label>
              <select id="certification" name="certification" style={INPUT_STYLE}>
                <option value="none">None</option>
                <option value="WOSB">WOSB</option>
                <option value="SDVOSB">SDVOSB</option>
                <option value="8a">8(a)</option>
                <option value="HUBZone">HUBZone</option>
                <option value="SDB">SDB</option>
              </select>
            </div>

            {/* Work Share */}
            <div>
              <label style={LABEL_STYLE} htmlFor="work_share_pct">Work Share %</label>
              <input
                id="work_share_pct"
                name="work_share_pct"
                type="number"
                min={0}
                max={100}
                placeholder="20"
                style={INPUT_STYLE}
              />
            </div>

            {/* Point of Contact */}
            <div>
              <label style={LABEL_STYLE} htmlFor="point_of_contact">Point of Contact</label>
              <input
                id="point_of_contact"
                name="point_of_contact"
                type="text"
                placeholder="Jane Smith"
                style={INPUT_STYLE}
              />
            </div>

            {/* Email */}
            <div>
              <label style={LABEL_STYLE} htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="jane@acme.com"
                style={INPUT_STYLE}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={LABEL_STYLE} htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Capabilities, certifications, prior relationship..."
                style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{
                marginTop: 4,
                width: '100%',
                padding: '9px 16px',
                background: '#2F80FF',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Add Partner
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
