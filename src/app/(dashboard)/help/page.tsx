import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { HelpCircle, Keyboard, MessageSquare, Zap } from 'lucide-react'

export const metadata = { title: 'Help & Support' }

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#C0C2C6',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const FAQ = [
  {
    q: 'How do I start my first proposal?',
    a: 'Go to Dashboard and click "Upload RFP". Upload your PDF or Word solicitation document. ProposalAI will extract and analyze it (usually under 2 minutes), then you\'ll see your win score, compliance matrix, and evaluation criteria.',
  },
  {
    q: 'What does the Quality Watchdog do?',
    a: 'When you click "Generate Section", the Quality Watchdog drafts the section, then automatically scores it against your RFP\'s evaluation criteria (Section M). If the score is below 90/100, it redrafts with targeted improvements — up to 3 attempts. You only see the approved final version.',
  },
  {
    q: 'Why is my win score low?',
    a: 'Win score is calculated from 5 factors: scope alignment, certifications match, set-aside match, past performance relevance, and competition level. The Analysis page shows the breakdown. Common fixes: add relevant past projects, complete your capability statement, and ensure your certifications are entered in your profile.',
  },
  {
    q: 'How do I add past performance?',
    a: 'Go to Profile → Past Projects. Add each relevant contract with agency name, dollar value, period of performance, and a scope narrative. The more detail you add, the better the AI can tailor your Past Performance section and rank projects by relevance.',
  },
  {
    q: 'What is the Capability Statement?',
    a: 'Your evergreen contractor identity — NAICS codes, certifications, facilities, equipment, key differentiators, and reference contacts. It feeds every proposal draft as context. Fill it out once and all proposals benefit automatically.',
  },
  {
    q: 'Can I edit the AI-generated draft?',
    a: 'Yes — the editor is fully editable. The AI draft is a starting point. Use the Compliance Panel (right sidebar) to verify all requirements are addressed, and the Past Performance panel to insert tailored narratives from your library.',
  },
  {
    q: 'How do I export my proposal?',
    a: 'From any proposal page, click "Export". Choose PDF or Word (.docx). PDF preserves formatting; Word is editable for final review. Export is available once at least one section has been drafted.',
  },
  {
    q: 'What is the Question Session?',
    a: 'Before drafting, ProposalAI generates 15–30 contract-specific questions covering scope, past performance, cost, schedule, compliance, and risk. Your answers are injected into every section draft as additional context — making the AI output much more specific to your firm.',
  },
  {
    q: 'My document is stuck on "Processing" — what do I do?',
    a: 'The Technical Watchdog auto-detects stuck processes every 5 minutes and resets them. If it\'s been more than 15 minutes, delete the proposal and re-upload the document. Make sure the PDF is not password-protected and is under 50MB.',
  },
  {
    q: 'How does team collaboration work?',
    a: 'Go to Account → Team and invite teammates by email. Owners can edit; editors can draft and modify; viewers can read but not write. Invitations are sent via email with an accept/decline link.',
  },
]

const SHORTCUTS = [
  { key: 'Ctrl + B', action: 'Bold' },
  { key: 'Ctrl + I', action: 'Italic' },
  { key: 'Ctrl + U', action: 'Underline' },
  { key: 'Ctrl + Z', action: 'Undo' },
  { key: 'Ctrl + Shift + Z', action: 'Redo' },
  { key: 'Tab', action: 'Indent list item' },
  { key: 'Shift + Tab', action: 'Outdent list item' },
]

export default async function HelpPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
          Help & Support
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.55)', marginTop: 6 }}>
          Quick start, FAQs, keyboard shortcuts, and how to reach us.
        </p>
      </div>

      {/* Quick start */}
      <GlassPanel style={{ padding: 24, marginBottom: 20 }}>
        <div style={SECTION_LABEL}>
          <Zap size={13} strokeWidth={1.5} />Quick Start
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Fill your profile', 'Profile → Company Info, Certifications, NAICS codes', '/profile'],
            ['Add past projects', 'Profile → Past Projects — add every relevant contract', '/profile/past-projects'],
            ['Complete your capability statement', 'Sets your firm identity for all proposals', '/capability-statement'],
            ['Upload an RFP', 'Dashboard → Upload RFP — PDF or Word', '/proposals/new'],
            ['Answer the question session', 'Opens after analysis — answers feed every draft section', null],
            ['Generate sections', 'Editor → click "Generate [Section]" — watchdog ensures quality', null],
            ['Export', 'PDF or Word — ready to submit', null],
          ].map(([title, desc, href], i) => (
            <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#FF1A1A',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "'Oxanium', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <div>
                {href ? (
                  <Link href={href} style={{ fontWeight: 600, fontSize: 13, color: '#FF1A1A', textDecoration: 'none' }}>{title}</Link>
                ) : (
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#F5F5F7' }}>{title}</span>
                )}
                <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.5)', margin: '2px 0 0' }}>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </GlassPanel>

      {/* FAQ */}
      <GlassPanel style={{ padding: 24, marginBottom: 20 }}>
        <div style={SECTION_LABEL}>
          <HelpCircle size={13} strokeWidth={1.5} />Frequently Asked Questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FAQ.map(({ q, a }) => (
            <details key={q} style={{ borderRadius: 8, border: '1px solid rgba(192,194,198,0.1)', overflow: 'hidden' }}>
              <summary style={{
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#F5F5F7',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(192,194,198,0.04)',
              }}>
                {q}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(192,194,198,0.4)" strokeWidth="2">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(192,194,198,0.65)', lineHeight: 1.6, margin: 0, borderTop: '1px solid rgba(192,194,198,0.07)' }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </GlassPanel>

      {/* Keyboard shortcuts */}
      <GlassPanel noPad style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(192,194,198,0.08)', ...SECTION_LABEL, marginBottom: 0 }}>
          <Keyboard size={13} strokeWidth={1.5} />Editor Keyboard Shortcuts
        </div>
        {SHORTCUTS.map(({ key, action }, i) => (
          <div key={key} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 20px',
            borderBottom: i < SHORTCUTS.length - 1 ? '1px solid rgba(192,194,198,0.06)' : 'none',
          }}>
            <kbd style={{
              padding: '3px 10px',
              borderRadius: 5,
              background: 'rgba(192,194,198,0.08)',
              border: '1px solid rgba(192,194,198,0.14)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: '#C0C2C6',
              fontWeight: 600,
            }}>{key}</kbd>
            <span style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)' }}>{action}</span>
          </div>
        ))}
      </GlassPanel>

      {/* Contact */}
      <GlassPanel style={{ padding: 24 }}>
        <div style={SECTION_LABEL}>
          <MessageSquare size={13} strokeWidth={1.5} />Contact Support
        </div>
        <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.6)', marginBottom: 16 }}>
          Can&apos;t find what you need? Send us a message and we&apos;ll respond within one business day.
        </p>
        <form action="mailto:support@hispanicconstructioncouncil.com" method="get" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Subject</label>
            <input
              name="subject"
              type="text"
              placeholder="e.g. Question about the editor"
              style={{
                width: '100%',
                border: '1px solid rgba(192,194,198,0.15)',
                borderRadius: 6,
                padding: '9px 12px',
                fontSize: 13,
                color: '#F5F5F7',
                background: 'rgba(11,11,13,0.5)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Message</label>
            <textarea
              name="body"
              rows={4}
              placeholder="Describe your issue or question..."
              style={{
                width: '100%',
                border: '1px solid rgba(192,194,198,0.15)',
                borderRadius: 6,
                padding: '9px 12px',
                fontSize: 13,
                color: '#F5F5F7',
                background: 'rgba(11,11,13,0.5)',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="submit" style={{
              padding: '9px 20px',
              background: '#FF1A1A',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Oxanium', sans-serif",
              letterSpacing: '0.08em',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}>
              OPEN IN EMAIL CLIENT
            </button>
            <a href="mailto:support@hispanicconstructioncouncil.com" style={{ fontSize: 11, color: 'rgba(192,194,198,0.45)', textDecoration: 'none' }}>
              support@hispanicconstructioncouncil.com
            </a>
          </div>
        </form>
      </GlassPanel>
    </div>
  )
}
