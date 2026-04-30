import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listSavedSearches } from '@/lib/saved-searches'
import { SavedSearchRow } from '@/components/saved-searches/SavedSearchRow'

export const metadata = {
  title: 'Saved Searches — ProposalAI',
}

export default async function SavedSearchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/saved-searches')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  const isSubscribed = ['active', 'trialing', 'past_due'].includes(
    profile?.subscription_status ?? ''
  )

  if (!isSubscribed) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-100 mb-4">Saved Searches</h1>
        <p className="text-gray-400 mb-6">Saved searches and email alerts are a subscriber feature.</p>
        <Link
          href="/account#billing"
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold uppercase tracking-wide bg-red-600 text-white hover:bg-red-500 rounded-lg transition-all"
        >
          Upgrade plan
        </Link>
      </main>
    )
  }

  const searches = await listSavedSearches()

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-100">Saved Searches</h1>
          <Link href="/opportunities" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            &larr; Back to opportunities
          </Link>
        </div>

        {searches.length === 0 ? (
          <div className="max-w-sm mx-auto mt-12 text-center">
            <div className="bg-white/5 border border-white/10 rounded-xl p-10">
              <div className="flex justify-center mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-100 mb-1">No saved searches yet</p>
              <p className="text-sm text-gray-400 mb-6">
                Search for opportunities and save your filters to get email alerts.
              </p>
              <Link
                href="/opportunities"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold uppercase tracking-wide bg-red-600 text-white hover:bg-red-500 rounded-lg transition-all"
              >
                Browse opportunities
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {searches.map((s) => (
              <SavedSearchRow key={s.id} search={s} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
