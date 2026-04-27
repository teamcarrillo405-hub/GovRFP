'use client'

import type { AnalysisRequirement } from '@/lib/analysis/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  sectionName: string
  sectionText: string
  requirements: AnalysisRequirement[]
}

interface GuidanceRule {
  id: string
  trigger: RegExp
  title: string
  body: string
  severity: 'warning' | 'tip' | 'required'
  sections?: string[]
}

// ── Rules ─────────────────────────────────────────────────────────────────────

const GUIDANCE_RULES: GuidanceRule[] = [
  {
    id: 'davis-bacon-wd',
    trigger: /davis.bacon|prevailing wage/i,
    title: 'Include Wage Determination Number',
    body: 'You referenced Davis-Bacon or prevailing wages. Include the specific WD number (e.g., "WD CA20240001 mod 5") in your cost narrative.',
    severity: 'required',
    sections: ['Technical Approach', 'Management Plan'],
  },
  {
    id: 'osha-10-proof',
    trigger: /osha/i,
    title: 'Reference OSHA Certification Evidence',
    body: 'Mention OSHA 10 or 30-hour certification. State how many workers hold current certifications and where records are maintained.',
    severity: 'tip',
    sections: ['Management Plan', 'Safety Plan'],
  },
  {
    id: 'pe-seal',
    trigger: /professional engineer|design.build|P\.E\.|PE seal/i,
    title: 'Identify Licensed PE by State',
    body: 'Name the licensed Professional Engineer and confirm their California (or applicable state) PE license number. Evaluators check this.',
    severity: 'required',
    sections: ['Technical Approach', 'Management Plan'],
  },
  {
    id: 'qcp-reference',
    trigger: /quality control|CQC|quality management/i,
    title: 'Link to Quality Control Plan',
    body: 'Reference your Quality Control Plan section explicitly. USACE requires CQC to be a separate, named section per EM 385-1-1.',
    severity: 'tip',
  },
  {
    id: 'cpars-rating',
    trigger: /past performance|CPARS|prior contract/i,
    title: 'Include CPARS Ratings',
    body: 'Cite specific CPARS ratings (Exceptional, Very Good) for referenced projects. Evaluators discount past performance without ratings.',
    severity: 'required',
    sections: ['Executive Summary', 'Technical Approach'],
  },
  {
    id: 'subcontract-plan',
    trigger: /subcontract|teaming partner|small business/i,
    title: 'Reference Subcontracting Plan',
    body: 'If a Small Business Subcontracting Plan is required, mention it here and reference the percentage targets you committed to.',
    severity: 'tip',
  },
  {
    id: 'schedule-duration',
    trigger: /schedule|NTP|notice to proceed|completion/i,
    title: 'Confirm Period of Performance',
    body: "State the exact period of performance in months/weeks. Confirm it matches the RFP's required period — mismatches are an instant deficiency.",
    severity: 'warning',
    sections: ['Project Schedule', 'Technical Approach'],
  },
  {
    id: 'bonding',
    trigger: /bond|surety/i,
    title: 'Confirm Bonding Capacity',
    body: 'State your bonding capacity and surety company. Required for contracts over $150K (Miller Act). Evaluators check this in management plans.',
    severity: 'required',
    sections: ['Management Plan'],
  },
  {
    id: 'naics-keyword',
    trigger: /earthwork|levee|grading|excavation|sitework|paving|utility/i,
    title: 'Confirm NAICS Code Alignment',
    body: 'Your scope mentions heavy civil work. Ensure NAICS 237990 or 237310 is cited in your capability statement and matches your SAM.gov registration.',
    severity: 'tip',
  },
]

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  GuidanceRule['severity'],
  { label: string; borderColor: string; badgeColor: string; badgeBg: string }
> = {
  required: {
    label: 'Required',
    borderColor: '#FF4D4F',
    badgeColor: '#FF4D4F',
    badgeBg: '#FF4D4F14',
  },
  warning: {
    label: 'Warning',
    borderColor: '#F59E0B',
    badgeColor: '#F59E0B',
    badgeBg: '#F59E0B14',
  },
  tip: {
    label: 'Tip',
    borderColor: '#2F80FF',
    badgeColor: '#2F80FF',
    badgeBg: '#2F80FF14',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WritingGuidancePanel({
  sectionName,
  sectionText,
  // requirements is accepted for future use (e.g., requirement-aware rules)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requirements: _requirements,
}: Props) {
  const activeHints = GUIDANCE_RULES.filter((rule) => {
    const sectionMatch = !rule.sections || rule.sections.includes(sectionName)
    return sectionMatch && rule.trigger.test(sectionText)
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 20px 12px',
          borderBottom: '1px solid #E2E8F0',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}
        >
          Writing Guidance
        </span>
        {activeHints.length > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#2F80FF',
              background: '#2F80FF14',
              borderRadius: 10,
              padding: '1px 7px',
              lineHeight: '18px',
            }}
          >
            {activeHints.length}
          </span>
        )}
      </div>

      {/* Hint list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {activeHints.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: '#94A3B8',
              textAlign: 'center',
              padding: '24px 12px',
              lineHeight: 1.6,
            }}
          >
            No guidance hints for this section. Keep writing — hints appear as you reference key
            topics.
          </p>
        ) : (
          activeHints.map((hint) => {
            const cfg = SEVERITY_CONFIG[hint.severity]
            return (
              <div
                key={hint.id}
                style={{
                  borderLeft: `3px solid ${cfg.borderColor}`,
                  background: '#FAFAFA',
                  borderRadius: '0 6px 6px 0',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0F172A',
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    {hint.title}
                  </span>
                  {/* Severity badge */}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: cfg.badgeColor,
                      background: cfg.badgeBg,
                      borderRadius: 4,
                      padding: '1px 6px',
                      whiteSpace: 'nowrap',
                      lineHeight: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Body */}
                <p
                  style={{
                    fontSize: 12,
                    color: '#475569',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {hint.body}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
