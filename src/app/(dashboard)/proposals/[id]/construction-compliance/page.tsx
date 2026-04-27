import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

interface Props {
  params: Promise<{ id: string }>
}

type CheckStatus = 'detected' | 'not_detected' | 'unknown'

interface CheckItem {
  name: string
  keywords: string[]
  status: CheckStatus
  matchedKeyword: string | null
}

interface Category {
  name: string
  items: CheckItem[]
}

function detectKeywords(rfpText: string | null | undefined, keywords: string[]): { status: CheckStatus; matchedKeyword: string | null } {
  if (!rfpText || rfpText.trim().length === 0) {
    return { status: 'unknown', matchedKeyword: null }
  }
  const lower = rfpText.toLowerCase()
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      return { status: 'detected', matchedKeyword: kw }
    }
  }
  return { status: 'not_detected', matchedKeyword: null }
}

function buildChecklist(rfpText: string | null | undefined, setAsideFlags: string[] | null | undefined): Category[] {
  const flags = setAsideFlags ?? []
  const hasSmallBizSetAside = flags.some((f) =>
    ['WOSB', 'SDVOSB', '8a', 'HUBZone', 'SDB'].includes(f)
  )
  // For SB subcontracting plan: also check rfp_text for "subcontracting plan" OR set_aside_flags
  const sbKeywords = hasSmallBizSetAside
    ? ['subcontracting plan', 'small business subcontracting']
    : ['subcontracting plan', 'small business subcontracting']

  const rawCategories: Array<{ name: string; items: Array<{ name: string; keywords: string[] }> }> = [
    {
      name: 'Labor Standards (Davis-Bacon Act)',
      items: [
        { name: 'Davis-Bacon wage determination required', keywords: ['Davis-Bacon', 'wage determination'] },
        { name: 'Weekly certified payroll required', keywords: ['certified payroll'] },
        { name: 'Apprenticeship ratios may apply', keywords: ['apprentice'] },
        { name: 'Anti-kickback provisions (Copeland Act)', keywords: ['Copeland', 'kickback'] },
      ],
    },
    {
      name: 'Safety & Health (OSHA)',
      items: [
        { name: 'OSHA 10-hour training required', keywords: ['OSHA 10', 'OSHA-10'] },
        { name: 'Site safety plan required', keywords: ['safety plan', 'accident prevention plan'] },
        { name: 'Competent Person designation required', keywords: ['Competent Person'] },
        { name: 'Accident prevention and safety program', keywords: ['EM 385', 'accident prevention'] },
      ],
    },
    {
      name: 'Environmental Compliance',
      items: [
        { name: 'NEPA compliance required', keywords: ['NEPA', 'environmental impact'] },
        { name: 'Section 404/401 permits', keywords: ['Section 404', '404 permit', 'Corps permit'] },
        { name: 'Stormwater pollution prevention plan', keywords: ['SWPPP', 'stormwater'] },
        { name: 'Hazardous material handling', keywords: ['hazardous', 'HAZMAT'] },
      ],
    },
    {
      name: 'Small Business Requirements',
      items: [
        { name: 'Small Business subcontracting plan required', keywords: sbKeywords },
        { name: 'Section 3 requirements (HUD/economic opportunity)', keywords: ['Section 3'] },
        { name: 'Mentor-protege arrangements', keywords: ['mentor', 'protege'] },
      ],
    },
    {
      name: 'Contract Administration',
      items: [
        { name: 'Certified Cost or Pricing Data', keywords: ['Truth in Negotiations', 'TINA', 'certified cost'] },
        { name: 'Quality Control Plan required', keywords: ['quality control', 'CQC'] },
        { name: 'Construction Quality Management', keywords: ['CQM', 'quality management'] },
        { name: 'Performance and Payment Bonds required', keywords: ['performance bond', 'payment bond'] },
        { name: 'Liquidated damages clause', keywords: ['liquidated damages'] },
      ],
    },
    {
      name: 'Technical Requirements',
      items: [
        { name: 'Design-Build delivery method', keywords: ['design-build', 'D-B'] },
        { name: 'Professional Engineer (PE) seal required', keywords: ['Professional Engineer', 'PE seal', 'licensed engineer'] },
        { name: 'USACE / Army Corps standards', keywords: ['EM 1110', 'Army Corps', 'USACE'] },
        { name: 'BIM/3D modeling requirements', keywords: ['BIM', 'Building Information Model'] },
      ],
    },
  ]

  return rawCategories.map((cat) => ({
    name: cat.name,
    items: cat.items.map((item) => {
      const { status, matchedKeyword } = detectKeywords(rfpText, item.keywords)
      return { name: item.name, keywords: item.keywords, status, matchedKeyword }
    }),
  }))
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'detected') {
    return (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#00C48C',
        background: '#00C48C14',
        padding: '2px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}>
        Detected in RFP
      </span>
    )
  }
  if (status === 'not_detected') {
    return (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#94A3B8',
        background: '#F0F2F5',
        padding: '2px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}>
        Not detected
      </span>
    )
  }
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: '#F59E0B',
      background: '#F59E0B14',
      padding: '2px 8px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
    }}>
      Analyze RFP first
    </span>
  )
}

function CategoryCountBadge({ detected, total }: { detected: number; total: number }) {
  const color = detected === total ? '#2F80FF' : detected > 0 ? '#F59E0B' : '#94A3B8'
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: color,
      background: detected === total ? '#2F80FF14' : detected > 0 ? '#F59E0B14' : '#F0F2F5',
      padding: '2px 8px',
      borderRadius: 4,
    }}>
      {detected} / {total} detected
    </span>
  )
}

export default async function ConstructionCompliancePage({ params }: Props) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, rfp_text')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  const { data: rfpAnalysis } = await supabase
    .from('rfp_analysis')
    .select('requirements, set_aside_flags, naics_codes')
    .eq('proposal_id', id)
    .maybeSingle()

  const rfpText = proposal.rfp_text as string | null | undefined
  const setAsideFlags = rfpAnalysis?.set_aside_flags as string[] | null | undefined

  const categories = buildChecklist(rfpText, setAsideFlags)

  // Global stats
  let totalDetected = 0
  let totalNotDetected = 0
  let totalUnknown = 0
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.status === 'detected') totalDetected++
      else if (item.status === 'not_detected') totalNotDetected++
      else totalUnknown++
    }
  }
  const grandTotal = totalDetected + totalNotDetected + totalUnknown

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', marginTop: -28, marginLeft: -28, marginRight: -28, background: '#F0F2F5' }}>
      {/* Top bar */}
      <div style={{
        height: 48,
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}>
        <Link
          href={`/proposals/${id}/editor`}
          style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {proposal.title}
        </Link>
        <span style={{ color: '#E2E8F0' }}>|</span>
        <h1 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Construction Compliance</h1>
      </div>

      {/* Page body */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 48px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            Construction Compliance
          </div>
          <div style={{ fontSize: 13, color: '#64748B' }}>
            Federal construction-specific requirements checklist
          </div>
        </div>

        {/* Summary stats bar */}
        <div style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '16px 24px',
          display: 'flex',
          gap: 32,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#00C48C', lineHeight: 1 }}>{totalDetected}</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>Detected</span>
          </div>
          <div style={{ width: 1, height: 36, background: '#E2E8F0', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#94A3B8', lineHeight: 1 }}>{totalNotDetected}</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>Not Detected</span>
          </div>
          <div style={{ width: 1, height: 36, background: '#E2E8F0', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{totalUnknown}</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>Unknown</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            {grandTotal} total requirements checked
          </div>
        </div>

        {/* Category cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {categories.map((cat) => {
            const catDetected = cat.items.filter((i) => i.status === 'detected').length
            const catTotal = cat.items.length

            return (
              <div
                key={cat.name}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {/* Card header */}
                <div style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FAFBFC',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{cat.name}</span>
                  <CategoryCountBadge detected={catDetected} total={catTotal} />
                </div>

                {/* Card rows */}
                <div>
                  {cat.items.map((item, idx) => (
                    <div
                      key={item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '11px 18px',
                        borderBottom: idx < cat.items.length - 1 ? '1px solid #F1F5F9' : 'none',
                        gap: 16,
                      }}
                    >
                      {/* Item name + matched keyword */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
                          {item.name}
                        </div>
                        {item.matchedKeyword && (
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            Matched: &ldquo;{item.matchedKeyword}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{ flexShrink: 0 }}>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 24,
          fontSize: 12,
          color: '#94A3B8',
          lineHeight: 1.6,
          borderTop: '1px solid #E2E8F0',
          paddingTop: 16,
        }}>
          This checklist is based on standard federal construction compliance requirements. Always verify against the specific solicitation&apos;s FAR/DFARS clauses and agency supplements.
        </div>
      </div>
    </div>
  )
}
