import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { CPARS_LABELS } from '@/lib/past-performance/types'

/**
 * Past Performance library — list of all records visible to the current
 * user (solo owned + team shared, enforced by RLS).
 *
 * Filters come in a follow-up (Day 5): NAICS, set-aside, customer search.
 */
export default async function PastPerformanceListPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('past_performance')
    .select(
      'id, contract_title, contract_number, customer_name, customer_agency_code, period_start, period_end, contract_value_usd, naics_codes, set_asides_claimed, cpars_rating, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Past Performance</h1>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load records: {error.message}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Past Performance</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows?.length ?? 0} record{rows?.length === 1 ? '' : 's'} in your library.
            Used to auto-draft PP narratives for each new proposal.
          </p>
        </div>
        <Link
          href="/past-performance/new"
          className="px-4 py-2 text-sm font-semibold rounded-md text-gray-900"
          style={{ backgroundColor: '#F5C518' }}
        >
          + Add record
        </Link>
      </div>

      {!rows || rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Contract</Th>
                <Th>Customer</Th>
                <Th>Period</Th>
                <Th>Value</Th>
                <Th>NAICS</Th>
                <Th>Set-asides</Th>
                <Th>CPARS</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <Td>
                    <Link
                      href={`/past-performance/${r.id}`}
                      className="font-medium text-gray-900 hover:text-yellow-700"
                    >
                      {r.contract_title}
                    </Link>
                    {r.contract_number && (
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {r.contract_number}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div>{r.customer_name}</div>
                    {r.customer_agency_code && (
                      <div className="text-xs text-gray-500">{r.customer_agency_code}</div>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {formatPeriod(r.period_start, r.period_end)}
                  </Td>
                  <Td className="text-xs font-mono">
                    {r.contract_value_usd != null
                      ? `$${Number(r.contract_value_usd).toLocaleString()}`
                      : '—'}
                  </Td>
                  <Td className="text-xs font-mono">
                    {(r.naics_codes ?? []).join(', ') || '—'}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(r.set_asides_claimed ?? []).map((s: string) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 text-xs rounded bg-yellow-50 text-yellow-900 border border-yellow-200"
                        >
                          {s}
                        </span>
                      ))}
                      {(r.set_asides_claimed ?? []).length === 0 && (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-xs">
                    {r.cpars_rating
                      ? CPARS_LABELS[r.cpars_rating as keyof typeof CPARS_LABELS]
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const fmt = (d: string) => d.slice(0, 7)
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  return fmt(start ?? end!)
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        No past-performance records yet
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
        Add your prior contracts to the library. When you draft a proposal, we&rsquo;ll
        rank them by relevance to the RFP and draft tailored PP narratives for
        you.
      </p>
      <Link
        href="/past-performance/new"
        className="inline-block px-5 py-2.5 text-sm font-semibold rounded-md text-gray-900"
        style={{ backgroundColor: '#F5C518' }}
      >
        Add your first record
      </Link>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
}
