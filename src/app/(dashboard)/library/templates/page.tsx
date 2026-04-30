import Link from 'next/link'
import { PROPOSAL_TEMPLATES, type ProposalTemplate } from '@/lib/templates/proposal-templates'
import { GlassPanel } from '@/components/ui/GlassPanel'

const CATEGORY_COLORS: Record<ProposalTemplate['category'], string> = {
  dod: '#FF4D4F',
  gsa: '#2F80FF',
  idiq: '#F59E0B',
  sbir: '#00C48C',
  construction: '#F97316',
  it: '#A855F7',
}

const CATEGORY_LABELS: Record<ProposalTemplate['category'], string> = {
  dod: 'DoD',
  gsa: 'GSA',
  idiq: 'IDIQ',
  sbir: 'SBIR',
  construction: 'Construction',
  it: 'IT / Cyber',
}

const DIFFICULTY_COLORS: Record<ProposalTemplate['difficulty'], string> = {
  beginner: '#00C48C',
  intermediate: '#F59E0B',
  advanced: '#FF4D4F',
}

export default function TemplatesPage() {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "'Oxanium', sans-serif",
            color: '#F5F5F7',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Proposal Templates
        </h1>
        <p
          style={{
            fontSize: 12,
            color: 'rgba(192,194,198,0.55)',
            marginTop: 4,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          Pre-built scaffolds for common federal contract types.
        </p>
      </div>

      {/* Back nav */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/library"
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.08em',
            color: 'rgba(192,194,198,0.6)',
            textDecoration: 'none',
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(192,194,198,0.06)',
            border: '1px solid rgba(192,194,198,0.12)',
          }}
        >
          CONTENT LIBRARY
        </Link>
        <span
          style={{
            fontSize: 10,
            fontFamily: "'Oxanium', sans-serif",
            color: 'rgba(192,194,198,0.3)',
            margin: '0 8px',
          }}
        >
          /
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'Oxanium', sans-serif",
            letterSpacing: '0.08em',
            color: '#F5F5F7',
          }}
        >
          TEMPLATES
        </span>
      </div>

      {/* Template grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}
      >
        {PROPOSAL_TEMPLATES.map((template) => {
          const categoryColor = CATEGORY_COLORS[template.category]
          const difficultyColor = DIFFICULTY_COLORS[template.difficulty]

          return (
            <GlassPanel key={template.id} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
              {/* Top row: category badge + difficulty badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "'Oxanium', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: categoryColor,
                    background: `${categoryColor}18`,
                    border: `1px solid ${categoryColor}30`,
                    padding: '3px 9px',
                    borderRadius: 4,
                  }}
                >
                  {CATEGORY_LABELS[template.category]}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "'Oxanium', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: difficultyColor,
                    background: `${difficultyColor}14`,
                    border: `1px solid ${difficultyColor}28`,
                    padding: '3px 9px',
                    borderRadius: 4,
                  }}
                >
                  {template.difficulty}
                </span>
              </div>

              {/* Template name */}
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: '#F5F5F7',
                  marginBottom: 4,
                  lineHeight: 1.3,
                }}
              >
                {template.name}
              </div>

              {/* Contract type */}
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: 'rgba(192,194,198,0.5)',
                  marginBottom: 10,
                }}
              >
                {template.contractType}
              </div>

              {/* Description — 2 line clamp */}
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(192,194,198,0.6)',
                  lineHeight: 1.6,
                  marginBottom: 12,
                  overflow: 'hidden',
                  display: '-webkit-box' as React.CSSProperties['display'],
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                  flex: 1,
                }}
              >
                {template.description}
              </div>

              {/* Agencies */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "'Oxanium', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(192,194,198,0.35)',
                    marginBottom: 5,
                  }}
                >
                  Typical Agencies
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: 'rgba(192,194,198,0.55)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {template.typicalAgencies.slice(0, 3).join(' · ')}
                  {template.typicalAgencies.length > 3 && (
                    <span style={{ color: 'rgba(192,194,198,0.35)' }}>
                      {' '}+{template.typicalAgencies.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row: section count + page estimate */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(192,194,198,0.07)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#F5F5F7',
                      lineHeight: 1,
                    }}
                  >
                    {template.sections.length}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'Oxanium', sans-serif",
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'rgba(192,194,198,0.4)',
                      marginTop: 2,
                    }}
                  >
                    Sections
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(192,194,198,0.08)' }} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#F5F5F7',
                      lineHeight: 1,
                    }}
                  >
                    {template.estimatedPages.split(' ')[0]}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'Oxanium', sans-serif",
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'rgba(192,194,198,0.4)',
                      marginTop: 2,
                    }}
                  >
                    Pages Est.
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(192,194,198,0.08)' }} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#F5F5F7',
                      lineHeight: 1,
                    }}
                  >
                    {template.sections.filter((s) => s.required).length}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'Oxanium', sans-serif",
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'rgba(192,194,198,0.4)',
                      marginTop: 2,
                    }}
                  >
                    Required
                  </div>
                </div>
              </div>

              {/* Use Template button */}
              <Link
                href={`/proposals/new?template=${template.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '9px 16px',
                  borderRadius: 6,
                  background: categoryColor,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Oxanium', sans-serif",
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                Use Template
              </Link>
            </GlassPanel>
          )
        })}
      </div>
    </div>
  )
}
