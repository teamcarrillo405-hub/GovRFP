import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { PastPerformanceForm } from '@/components/past-performance/PastPerformanceForm'
import {
  updatePastPerformance,
  deletePastPerformance,
} from '@/app/(dashboard)/past-performance/actions'
import type { PastPerformanceInput } from '@/lib/past-performance/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPastPerformancePage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('past_performance')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) notFound()

  // Strip DB-only fields to match PastPerformanceInput shape
  const initial: Partial<PastPerformanceInput> = {
    team_id: row.team_id,
    contract_title: row.contract_title,
    contract_number: row.contract_number,
    customer_name: row.customer_name,
    customer_agency_code: row.customer_agency_code,
    customer_poc_name: row.customer_poc_name,
    customer_poc_email: row.customer_poc_email,
    period_start: row.period_start,
    period_end: row.period_end,
    contract_value_usd: row.contract_value_usd ? Number(row.contract_value_usd) : null,
    naics_codes: row.naics_codes ?? [],
    set_asides_claimed: row.set_asides_claimed ?? [],
    scope_narrative: row.scope_narrative,
    key_personnel: row.key_personnel ?? [],
    outcomes: row.outcomes,
    cpars_rating: row.cpars_rating,
    tags: row.tags ?? [],
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/past-performance"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        ← Back to library
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{row.contract_title}</h1>
      <p className="text-sm text-gray-500 mb-8">Edit past-performance record</p>

      <PastPerformanceForm
        initial={initial}
        onSubmit={updatePastPerformance.bind(null, id)}
        onDelete={deletePastPerformance.bind(null, id)}
        submitLabel="Save changes"
      />
    </main>
  )
}
