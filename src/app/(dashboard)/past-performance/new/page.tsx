import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { WizardShell } from '@/components/past-performance/WizardShell'
import { PastPerformanceForm } from '@/components/past-performance/PastPerformanceForm'
import { createPastPerformance } from '@/app/(dashboard)/past-performance/actions'

interface SearchParams {
  'skip-wizard'?: string
}

/**
 * Create a new Past Performance record.
 *
 * Default: 3-step wizard (Identify → Scope → Outcomes). Power users can
 * bypass via ?skip-wizard=1 for a single-page form with every field
 * visible at once.
 */
export default async function NewPastPerformancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const skipWizard = params['skip-wizard'] === '1'

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/past-performance"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        ← Back to library
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {skipWizard ? 'New Past Performance record' : 'Add a Past Performance record'}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        FAR 15.305 past-performance evidence. Used to auto-draft PP narratives
        for future RFP proposals.
      </p>

      {skipWizard ? (
        <PastPerformanceForm onSubmit={createPastPerformance} submitLabel="Create record" />
      ) : (
        <WizardShell onSubmit={createPastPerformance} />
      )}
    </main>
  )
}
