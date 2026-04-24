import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { StatCard, Badge, Button } from '@hcc/ui'

interface ProfileCompletionData {
  company_name: string | null
  certifications: string[] | null
  naics_codes: string[] | null
  capability_statement: string | null
}

function getProfileCompletion(profile: ProfileCompletionData | null): {
  complete: number
  total: number
  missing: string[]
} {
  if (!profile) {
    return {
      complete: 0,
      total: 4,
      missing: ['Company name', 'Certifications', 'NAICS codes', 'Capability statement'],
    }
  }

  const checks: Array<{ label: string; done: boolean }> = [
    { label: 'Company name',         done: !!profile.company_name },
    { label: 'Certifications',        done: (profile.certifications?.length ?? 0) > 0 },
    { label: 'NAICS codes',           done: (profile.naics_codes?.length ?? 0) > 0 },
    { label: 'Capability statement',  done: !!profile.capability_statement },
  ]

  return {
    complete: checks.filter((c) => c.done).length,
    total:    checks.length,
    missing:  checks.filter((c) => !c.done).map((c) => c.label),
  }
}

function firstName(email: string): string {
  return email.split('@')[0].split(/[._-]/)[0]
}

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, certifications, naics_codes, capability_statement')
    .eq('id', user.id)
    .single()

  const completion    = getProfileCompletion(profile)
  const completionPct = Math.round((completion.complete / completion.total) * 100)

  const [proposalsResult, pendingInvitesResult] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, status, file_name, created_at, team_id, user_id')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('team_invites')
      .select('id, team_id, role, teams(name)')
      .eq('invitee_email', user.email!)
      .eq('status', 'pending'),
  ])

  const proposals      = proposalsResult.data ?? []
  const pendingInvites = pendingInvitesResult.data ?? []
  const isFirstRun     = proposals.length === 0

  const analyzedCount  = proposals.filter((p) => p.status === 'analyzed').length
  const totalCount     = proposals.length

  const name = firstName(user.email ?? 'there')

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-sans">

      {/* ── Welcome headline ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Welcome back, <span className="capitalize">{name}</span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Let&rsquo;s win your next contract.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Proposals" value={totalCount} />
        <StatCard label="Analyzed" value={analyzedCount} />
        <StatCard label="Profile" value={`${completionPct}%`} sub="complete" />
        <StatCard label="Pending Invites" value={pendingInvites.length} />
      </div>

      {/* ── Pending invite banners ── */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 space-y-3">
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-xl border border-[#FDFF66] bg-[#FDFF66]/10 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Team invite — join as{' '}
                  <span className="capitalize text-gray-700">{invite.role}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(invite as { teams?: { name?: string } }).teams?.name ?? 'a proposal team'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/invite/accept?invite_id=${invite.id}&team_id=${invite.team_id}`}>
                  <Button size="sm" variant="primary">Accept</Button>
                </a>
                <a href={`/invite/decline?invite_id=${invite.id}`}>
                  <Button size="sm" variant="ghost">Decline</Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Primary CTA — Upload RFP ── */}
      <Link
        href="/proposals/new"
        className="group block mb-6 rounded-xl border-l-4 border-l-[#FDFF66] border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Upload RFP
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Upload a government RFP (PDF or Word) to start building your proposal.
            </p>
          </div>
          <span className="shrink-0 px-4 py-2 bg-[#FDFF66] text-black text-xs font-black uppercase tracking-wide rounded-lg group-hover:brightness-105 transition-all shadow-sm">
            Start
          </span>
        </div>
      </Link>

      {/* ── First-run onboarding checklist ── */}
      {isFirstRun && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-[#EDF1F4]/30 p-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">
            Get started in 4 steps
          </h2>
          <ol className="space-y-4">
            {[
              {
                label:  'Complete your profile',
                done:   completionPct === 100,
                href:   '/profile',
                detail: 'Company info, certifications, and NAICS codes used in every proposal.',
              },
              {
                label:  'Upload your first RFP',
                done:   false,
                href:   '/proposals/new',
                detail: 'PDF or Word file — the AI extracts requirements and scores your fit.',
              },
              {
                label:  'Answer contract-specific questions',
                done:   false,
                href:   null,
                detail: 'Available after upload. Answers sharpen each drafted section.',
              },
              {
                label:  'Generate AI-drafted proposal sections',
                done:   false,
                href:   null,
                detail: 'The Quality Watchdog auto-redrafts until each section scores 90+.',
              },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className={[
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black',
                    step.done
                      ? 'bg-[#FDFF66] text-black'
                      : 'border-2 border-gray-300 text-gray-500 bg-white',
                  ].join(' ')}
                >
                  {step.done ? '✓' : i + 1}
                </span>
                <div>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className="text-sm font-semibold text-gray-900 hover:text-black hover:underline"
                    >
                      {step.label}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500">{step.label}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Quick nav grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {[
          {
            href:   '/profile',
            label:  'Edit Profile',
            detail: 'Company info, certifications, NAICS codes, capability statement.',
          },
          {
            href:   '/profile/past-projects',
            label:  'Past Projects',
            detail: 'Contract history used to demonstrate past performance.',
          },
          {
            href:   '/profile/key-personnel',
            label:  'Key Personnel',
            detail: 'Team member bios and certifications for management sections.',
          },
          {
            href:   '/account',
            label:  'Account Settings',
            detail: 'Subscription status, billing, and account management.',
          },
          {
            href:   '/help',
            label:  'Help Center',
            detail: 'Guides, FAQs, and support resources.',
          },
        ].map(({ href, label, detail }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-[#FDFF66] hover:shadow-sm transition-all"
          >
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-black transition-colors mb-1">
              {label}
            </h3>
            <p className="text-xs text-gray-500">{detail}</p>
          </Link>
        ))}
      </div>

      {/* ── Profile completion card ── */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Profile Completion</h2>
          <span className="text-sm font-black text-[#ff7b20]">{completionPct}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div
            className={`h-1.5 rounded-full transition-all ${
              completionPct === 100 ? 'bg-green-500' : 'bg-[#FDFF66]'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {completion.missing.length > 0 ? (
          <p className="text-xs text-gray-500">
            Missing:{' '}
            <span className="text-gray-700">{completion.missing.join(', ')}</span>
          </p>
        ) : (
          <p className="text-xs text-green-600 font-semibold">Profile complete.</p>
        )}
      </div>

      {/* ── Recent Proposals ── */}
      {proposals.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
            Recent Proposals
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {proposals.map((p) => {
              const isShared      = p.team_id && p.user_id !== user.id
              const isHighlighted = p.status === 'analyzed' || p.status === 'ready'
              return (
                <Link
                  key={p.id}
                  href={`/proposals/${p.id}`}
                  className={[
                    'flex items-center justify-between p-4 transition-colors hover:bg-gray-50',
                    isHighlighted ? 'border-l-4 border-l-[#FDFF66]' : '',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                    {p.file_name && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{p.file_name}</p>
                    )}
                  </div>
                  {isShared ? (
                    <Badge variant="shared" />
                  ) : (
                    <Badge
                      variant={
                        p.status === 'analyzed'   ? 'analyzed'   :
                        p.status === 'ready'       ? 'ready'       :
                        p.status === 'processing'  ? 'processing'  :
                        'draft'
                      }
                    />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
