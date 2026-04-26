import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'

export const metadata = { title: 'Help & Support' }

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
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-12">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
        <p className="mt-2 text-gray-500">
          Answers to common questions, keyboard shortcuts, and how to reach us.
        </p>
      </div>

      {/* Quick start */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick start</h2>
        <ol className="space-y-3 text-sm text-gray-700">
          {[
            ['Fill your profile', 'Profile → Company Info, Certifications, NAICS codes', '/profile'],
            ['Add past projects', 'Profile → Past Projects — add every relevant contract', '/profile/past-projects'],
            ['Complete your capability statement', 'Sets your firm identity for all proposals', '/capability-statement'],
            ['Upload an RFP', 'Dashboard → Upload RFP — PDF or Word', '/proposals/new'],
            ['Answer the question session', 'Opens after analysis — answers feed every draft section', null],
            ['Generate sections', 'Editor → click "Generate [Section]" — watchdog ensures quality', null],
            ['Export', 'PDF or Word — ready to submit', null],
          ].map(([title, desc, href], i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F80FF] text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                {href ? (
                  <Link href={href} className="font-medium text-blue-700 hover:underline">{title}</Link>
                ) : (
                  <span className="font-medium text-gray-900">{title}</span>
                )}
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently asked questions</h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group border border-gray-200 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-900 list-none">
                {q}
                <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Editor keyboard shortcuts</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Shortcut</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SHORTCUTS.map(({ key, action }) => (
                <tr key={key}>
                  <td className="px-4 py-2">
                    <kbd className="px-2 py-0.5 rounded bg-gray-100 border border-gray-300 font-mono text-xs">{key}</kbd>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact support</h2>
        <ContactForm />
      </section>
    </div>
  )
}

function ContactForm() {
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <p className="text-sm text-gray-600">
        Can&apos;t find what you need? Send us a message and we&apos;ll respond within one business day.
      </p>
      <form
        action={`mailto:support@hispanicconstructioncouncil.com`}
        method="get"
        className="space-y-3"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            name="subject"
            type="text"
            placeholder="e.g. Question about the editor"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            name="body"
            rows={4}
            placeholder="Describe your issue or question..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800"
        >
          Open in email client
        </button>
      </form>
      <p className="text-xs text-gray-500">
        Or email us directly at{' '}
        <a href="mailto:support@hispanicconstructioncouncil.com" className="underline">
          support@hispanicconstructioncouncil.com
        </a>
      </p>
    </div>
  )
}
