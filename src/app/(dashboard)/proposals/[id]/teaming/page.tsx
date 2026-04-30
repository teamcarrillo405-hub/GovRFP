import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { addTeamingPartner, deleteTeamingPartner } from './actions'

interface Props {
  params: Promise<{ id: string }>
}

interface TeamingPartner {
  id: string
  proposal_id: string
  user_id: string
  partner_name: string
  role: string
  workshare_pct: number
  naics_codes: string[]
  sba_certifications: string[]
  contact_email: string | null
  notes: string | null
  created_at: string
}

const WORKSHARE_PALETTE = [
  '#FF1A1A',
  '#2F80FF',
  '#00C48C',
  '#F59E0B',
  '#A855F7',
  '#F97316',
]

const SBA_CERT_COLORS: Record<string, string> = {
  '8(a)':    '#2F80FF',
  HUBZone:   '#00C48C',
  SDVOSB:    '#F59E0B',
  WOSB:      '#A855F7',
  VOSB:      '#F97316',
}

const GLASS: React.CSSProperties = {
  background: 'rgba(26,29,33,0.72)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(192,194,198,0.1)',
  borderRadius: 8,
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  background: 'rgba(11,11,13,0.5)',
  border: '1px solid rgba(192,194,198,0.15)',
  borderRadius: 6,
  color: '#C0C2C6',
  padding: '8px 12px',
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
  fontFamily: "'Oxanium', sans-serif",
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'rgba(192,194,198,0.45)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'Space Grotesk', sans-serif",
}

function roleBadge(role: string) {
  const colorMap: Record<string, string> = {
    Prime:          '#FF1A1A',
    Subcontractor:  '#2F80FF',
    Consultant:     '#A855F7',
    'JV Partner':   '#00C48C',
  }
  const color = colorMap[role] ?? '#94A3B8'
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: color + '1A',
        padding: '2px 8px',
        borderRadius: 4,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {role}
    </span>
  )
}

function sbaBadges(certs: string[]) {
  if (!certs || certs.length === 0) return <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.35)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {certs.map((cert) => {
        const color = SBA_CERT_COLORS[cert] ?? '#94A3B8'
        return (
          <span
            key={cert}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color,
              background: color + '1A',
              padding: '2px 6px',
              borderRadius: 3,
              fontFamily: "'Oxanium', sans-serif",
              letterSpacing: '0.03em',
            }}
          >
            {cert}
          </span>
        )
      })}
    </div>
  )
}

export default async function TeamingPage({ params }: Props) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  let partners: TeamingPartner[] = []
  try {
    const { data: partnerData } = await supabase
      .from('teaming_partners' as any)
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true })
    partners = (partnerData ?? []) as TeamingPartner[]
  } catch {
    partners = []
  }

  const totalWorkshare = partners.reduce((sum, p) => sum + (p.workshare_pct ?? 0), 0)
  const remaining = Math.max(0, 100 - totalWorkshare)
  const workshareOver = totalWorkshare > 100
  const partnerCount = partners.length

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
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "'Oxanium', sans-serif",
            color: '#F5F5F7',
            margin: 0,
          }}
        >
          Teaming Structure
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.55)', marginTop: 6, marginBottom: 0 }}>
          {partnerCount} partner{partnerCount !== 1 ? 's' : ''}{' '}
          &middot;{' '}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{totalWorkshare.toFixed(2)}%</span> allocated{' '}
          &middot;{' '}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{remaining.toFixed(2)}%</span> available
        </p>
      </div>

      {/* Workshare exceeded warning */}
      {workshareOver && (
        <div
          style={{
            background: 'rgba(255,26,26,0.08)',
            border: '1px solid rgba(255,26,26,0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            color: '#FF1A1A',
          }}
        >
          Total workshare exceeds 100%. Review partner allocations.
        </div>
      )}

      {/* Stats bar */}
      <div
        style={{
          ...GLASS,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Total Partners', value: String(partnerCount) },
          {
            label: 'Total Workshare %',
            value: totalWorkshare.toFixed(2) + '%',
            danger: workshareOver,
          },
          {
            label: 'Prime Capacity %',
            value: remaining.toFixed(2) + '%',
          },
        ].map((stat, idx) => (
          <div
            key={stat.label}
            style={{
              padding: '18px 24px',
              borderRight: idx < 2 ? '1px solid rgba(192,194,198,0.08)' : 'none',
            }}
          >
            <div style={SECTION_TITLE}>{stat.label}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                fontFamily: "'IBM Plex Mono', monospace",
                color: stat.danger ? '#FF1A1A' : '#F5F5F7',
                marginTop: 6,
                lineHeight: 1,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Workshare allocation bar */}
      {partners.length > 0 && (
        <div
          style={{
            ...GLASS,
            padding: '16px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ ...SECTION_TITLE, marginBottom: 12 }}>Workshare Allocation</div>
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 36,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'rgba(11,11,13,0.4)',
            }}
          >
            {partners.map((partner, idx) => {
              const pct = Math.min(partner.workshare_pct ?? 0, 100)
              const color = WORKSHARE_PALETTE[idx % WORKSHARE_PALETTE.length]
              const showLabel = pct > 10
              return (
                <div
                  key={partner.id}
                  style={{
                    width: `${pct}%`,
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'width 0.4s',
                    minWidth: pct > 0 ? 2 : 0,
                  }}
                  title={`${partner.partner_name}: ${pct}%`}
                >
                  {showLabel && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '0 6px',
                        fontFamily: "'Oxanium', sans-serif",
                      }}
                    >
                      {partner.partner_name}
                    </span>
                  )}
                </div>
              )
            })}
            {/* Remaining capacity */}
            {remaining > 0 && (
              <div
                style={{
                  width: `${Math.min(remaining, 100)}%`,
                  background: 'rgba(192,194,198,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={`Available: ${remaining.toFixed(2)}%`}
              />
            )}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {partners.map((partner, idx) => {
              const color = WORKSHARE_PALETTE[idx % WORKSHARE_PALETTE.length]
              return (
                <div key={partner.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(192,194,198,0.6)',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {partner.partner_name}{' '}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)' }}>
                      {(partner.workshare_pct ?? 0).toFixed(2)}%
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Partners table */}
      <div style={{ ...GLASS, marginBottom: 20, overflow: 'hidden' }}>
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 100px 1.2fr 1.4fr 1.2fr 70px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(192,194,198,0.08)',
            background: 'rgba(11,11,13,0.3)',
          }}
        >
          {['Partner', 'Role', 'Workshare', 'NAICS', 'SBA Certs', 'Contact', ''].map((col) => (
            <div
              key={col}
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(192,194,198,0.45)',
                padding: '0 6px',
                fontFamily: "'Oxanium', sans-serif",
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
              padding: '48px 24px',
              textAlign: 'center',
              color: 'rgba(192,194,198,0.35)',
              fontSize: 13,
            }}
          >
            No teaming partners added yet. Use the form below to add your first partner.
          </div>
        )}

        {/* Rows */}
        {partners.map((partner, idx) => (
          <div
            key={partner.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 100px 1.2fr 1.4fr 1.2fr 70px',
              padding: '12px 16px',
              borderBottom: idx < partners.length - 1 ? '1px solid rgba(192,194,198,0.06)' : 'none',
              alignItems: 'center',
            }}
          >
            {/* Partner name */}
            <div style={{ padding: '0 6px' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#F5F5F7',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {partner.partner_name}
              </div>
            </div>

            {/* Role */}
            <div style={{ padding: '0 6px' }}>
              {roleBadge(partner.role)}
            </div>

            {/* Workshare */}
            <div style={{ padding: '0 6px' }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: WORKSHARE_PALETTE[idx % WORKSHARE_PALETTE.length],
                }}
              >
                {(partner.workshare_pct ?? 0).toFixed(2)}%
              </span>
            </div>

            {/* NAICS codes */}
            <div style={{ padding: '0 6px' }}>
              {partner.naics_codes && partner.naics_codes.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {partner.naics_codes.map((code) => (
                    <span
                      key={code}
                      style={{
                        fontSize: 10,
                        color: 'rgba(192,194,198,0.55)',
                        background: 'rgba(192,194,198,0.06)',
                        padding: '2px 5px',
                        borderRadius: 3,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.3)' }}>—</span>
              )}
            </div>

            {/* SBA certs */}
            <div style={{ padding: '0 6px' }}>
              {sbaBadges(partner.sba_certifications)}
            </div>

            {/* Contact email */}
            <div style={{ padding: '0 6px' }}>
              {partner.contact_email ? (
                <a
                  href={`mailto:${partner.contact_email}`}
                  style={{
                    fontSize: 11,
                    color: 'rgba(192,194,198,0.5)',
                    textDecoration: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    wordBreak: 'break-all',
                  }}
                >
                  {partner.contact_email}
                </a>
              ) : (
                <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.3)' }}>—</span>
              )}
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
                    color: 'rgba(192,194,198,0.4)',
                    background: 'none',
                    border: '1px solid rgba(192,194,198,0.1)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.02em',
                  }}
                >
                  Remove
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {/* Add Partner form */}
      <div style={{ ...GLASS, padding: '24px' }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#F5F5F7',
            marginBottom: 20,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Add Partner
        </div>

        <form
          action={addTeamingPartner.bind(null, id)}
          style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {/* Row 1: name + role + workshare */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 120px',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={LABEL_STYLE} htmlFor="partner_name">Partner Name</label>
              <input
                id="partner_name"
                name="partner_name"
                type="text"
                required
                placeholder="Acme Contractors Inc."
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label style={LABEL_STYLE} htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                style={{ ...INPUT_STYLE, appearance: 'none' as React.CSSProperties['appearance'] }}
              >
                <option value="Subcontractor">Subcontractor</option>
                <option value="Prime">Prime</option>
                <option value="Consultant">Consultant</option>
                <option value="JV Partner">JV Partner</option>
              </select>
            </div>

            <div>
              <label style={LABEL_STYLE} htmlFor="workshare_pct">Workshare %</label>
              <input
                id="workshare_pct"
                name="workshare_pct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="20.00"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Row 2: NAICS + contact email */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={LABEL_STYLE} htmlFor="naics_codes">NAICS Codes (comma-separated)</label>
              <input
                id="naics_codes"
                name="naics_codes"
                type="text"
                placeholder="236220, 237310"
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label style={LABEL_STYLE} htmlFor="contact_email">Contact Email</label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="contact@partner.com"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* SBA certifications */}
          <div style={{ marginBottom: 16 }}>
            <span style={LABEL_STYLE}>SBA Certifications</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              {['8(a)', 'HUBZone', 'SDVOSB', 'WOSB', 'VOSB'].map((cert) => (
                <label
                  key={cert}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'rgba(192,194,198,0.7)',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <input
                    type="checkbox"
                    name="sba_certifications"
                    value={cert}
                    style={{ accentColor: SBA_CERT_COLORS[cert] ?? '#2F80FF', width: 14, height: 14 }}
                  />
                  {cert}
                </label>
              ))}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'rgba(192,194,198,0.4)',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                <input
                  type="checkbox"
                  name="sba_certifications"
                  value="None"
                  style={{ accentColor: '#94A3B8', width: 14, height: 14 }}
                />
                None
              </label>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={LABEL_STYLE} htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Capabilities, prior relationship, contract vehicles..."
              style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#FF1A1A',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              fontFamily: "'Oxanium', sans-serif",
            }}
          >
            Add Partner
          </button>
        </form>
      </div>
    </div>
  )
}
