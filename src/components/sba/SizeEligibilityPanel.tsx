import Link from 'next/link'
import { getSizeStandard } from '@/lib/sba/size-standards'

interface Props {
  naics: string | null
  annualRevenueUsd: number | null
  employeeCount: number | null
  sbaCategory: 'small' | 'other_than_small' | null
}

export function SizeEligibilityPanel({ naics, annualRevenueUsd, employeeCount, sbaCategory }: Props) {
  if (!naics) return null

  const standard = getSizeStandard(naics)
  const hasData = annualRevenueUsd !== null || employeeCount !== null || sbaCategory !== null

  if (!hasData) {
    return (
      <div style={{ padding: '14px 20px', background: 'rgba(26,29,33,0.72)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          SBA SIZE STANDARD
        </div>
        <p style={{ fontSize: 12, color: '#C0C2C6', marginBottom: 12, lineHeight: 1.5 }}>
          Complete your profile to check SBA size eligibility for this opportunity.
        </p>
        <Link href="/profile" style={{ fontSize: 11, fontWeight: 700, color: '#FF1A1A', textDecoration: 'none', fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em' }}>
          UPDATE PROFILE
        </Link>
      </div>
    )
  }

  let status: 'eligible' | 'ineligible' | 'unknown' = 'unknown'
  let statusLabel = 'Unknown'
  let statusColor = '#C0C2C6'

  if (sbaCategory === 'small') {
    status = 'eligible'
    statusLabel = 'Eligible — Small Business'
    statusColor = '#00C48C'
  } else if (sbaCategory === 'other_than_small') {
    status = 'ineligible'
    statusLabel = 'Ineligible — Other Than Small'
    statusColor = '#FF4D4F'
  } else if (standard.threshold_type === 'revenue' && annualRevenueUsd !== null) {
    const revenueMillions = annualRevenueUsd / 1_000_000
    status = revenueMillions <= standard.threshold_value ? 'eligible' : 'ineligible'
    statusLabel = status === 'eligible' ? 'Eligible — Small Business' : 'Ineligible — Exceeds Threshold'
    statusColor = status === 'eligible' ? '#00C48C' : '#FF4D4F'
  } else if (standard.threshold_type === 'employees' && employeeCount !== null) {
    status = employeeCount <= standard.threshold_value ? 'eligible' : 'ineligible'
    statusLabel = status === 'eligible' ? 'Eligible — Small Business' : 'Ineligible — Exceeds Threshold'
    statusColor = status === 'eligible' ? '#00C48C' : '#FF4D4F'
  }

  return (
    <div style={{ background: 'rgba(26,29,33,0.72)', border: `1px solid ${statusColor}22`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(192,194,198,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          SBA SIZE STANDARD
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${statusColor}18`, color: statusColor, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          {status.toUpperCase()}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: statusColor, marginBottom: 10 }}>
          {statusLabel}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ color: '#F5F5F7', fontWeight: 600 }}>NAICS: </span>
            {naics} — {standard.threshold_label} {standard.threshold_type === 'revenue' ? 'annual receipts' : 'employees'}
          </div>
          {annualRevenueUsd !== null && (
            <div style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: '#F5F5F7', fontWeight: 600 }}>Your Revenue: </span>
              ${(annualRevenueUsd / 1_000_000).toFixed(1)}M
            </div>
          )}
          {employeeCount !== null && (
            <div style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: '#F5F5F7', fontWeight: 600 }}>Employees: </span>
              {employeeCount}
            </div>
          )}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(192,194,198,0.5)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 12, borderTop: '1px solid rgba(192,194,198,0.08)', paddingTop: 10, lineHeight: 1.5 }}>
          Per SBA Table of Size Standards (2024). Self-reported data — consult SBA for official determination.
        </p>
      </div>
    </div>
  )
}
