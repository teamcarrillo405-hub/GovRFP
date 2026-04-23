import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

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
    { label: 'Company name', done: !!profile.company_name },
    { label: 'Certifications', done: (profile.certifications?.length ?? 0) > 0 },
    { label: 'NAICS codes', done: (profile.naics_codes?.length ?? 0) > 0 },
    { label: 'Capability statement', done: !!profile.capability_statement },
  ]

  return {
    complete: checks.filter((c) => c.done).length,
    total: checks.length,
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  }
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

  const completion = getProfileCompletion(profile)
  const completionPercent = Math.round((completion.complete / completion.total) * 100)

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, file_name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link href="/help" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Help
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-8">{user.email}</p>

      {/* Profile Completion Card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Profile Completion</h2>
          <span className="text-sm font-medium text-gray-700">{completionPercent}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all ${
              completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        {completion.missing.length > 0 ? (
          <p className="text-sm text-gray-500">
            Missing: {completion.missing.join(', ')}
          </p>
        ) : (
          <p className="text-sm text-green-700 font-medium">Profile complete.</p>
        )}
      </div>

      {/* Navigation grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/proposals/new"
          className="group rounded-lg border-2 border-blue-200 bg-blue-50 p-5 hover:border-blue-400 hover:shadow-sm transition-all sm:col-span-2"
        >
          <h3 className="text-sm font-semibold text-blue-900 group-hover:text-blue-700 mb-1">
            Upload RFP
          </h3>
          <p className="text-xs text-blue-700">
            Upload a government RFP (PDF or Word) to start building your proposal.
          </p>
        </Link>

        <Link
          href="/profile"
          className="group rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 mb-1">
            Edit Profile
          </h3>
          <p className="text-xs text-gray-500">
            Company info, certifications, NAICS codes, capability statement.
          </p>
        </Link>

        <Link
          href="/profile/past-projects"
          className="group rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 mb-1">
            Past Projects
          </h3>
          <p className="text-xs text-gray-500">
            Contract history used to demonstrate past performance in proposals.
          </p>
        </Link>

        <Link
          href="/profile/key-personnel"
          className="group rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 mb-1">
            Key Personnel
          </h3>
          <p className="text-xs text-gray-500">
            Team member bios and certifications included in management sections.
          </p>
        </Link>

        <Link
          href="/account"
          className="group rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 mb-1">
            Account Settings
          </h3>
          <p className="text-xs text-gray-500">
            Subscription status, billing, and account management.
          </p>
        </Link>
      </div>

      {/* Recent Proposals */}
      {proposals && proposals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Proposals</h2>
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {proposals.map((p) => (
              <Link
                key={p.id}
                href={`/proposals/${p.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.title}</p>
                  {p.file_name && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.file_name}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  p.status === 'ready'
                    ? 'bg-green-50 text-green-700'
                    : p.status === 'processing'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.status === 'ready' ? 'Ready' : p.status === 'processing' ? 'Processing' : 'Draft'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
