import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { CapabilityStatementForm } from '@/components/capability-statement/CapabilityStatementForm'
import { upsertCapabilityStatement } from '@/app/(dashboard)/capability-statement/actions'
import type { CapabilityStatementInput } from '@/lib/capability-statement/types'

interface SearchParams {
  saved?: string
}

/**
 * Capability Statement editor.
 *
 * One row per team or solo user (enforced by partial unique indexes).
 * RLS scopes the read; we just fetch the (at-most-one) row and pass to
 * the form. Form upserts on save.
 */
export default async function CapabilityStatementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const supabase = await createClient()

  // RLS narrows to: solo (user_id = auth.uid() AND team_id IS NULL) OR team rows
  // For V1, prefer the solo row if one exists. Team-row UX comes when teams ship.
  const { data: row } = await supabase
    .from('capability_statements')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Strip DB-only columns to get the form's input shape
  const initial: Partial<CapabilityStatementInput> | undefined = row
    ? {
        team_id: row.team_id,
        company_name: row.company_name,
        dba_name: row.dba_name,
        uei: row.uei,
        cage_code: row.cage_code,
        duns_number: row.duns_number,
        founding_year: row.founding_year,
        hq_address: row.hq_address,
        hq_city: row.hq_city,
        hq_state: row.hq_state,
        hq_zip: row.hq_zip,
        primary_contact_name: row.primary_contact_name,
        primary_contact_title: row.primary_contact_title,
        primary_contact_email: row.primary_contact_email,
        primary_contact_phone: row.primary_contact_phone,
        website_url: row.website_url,
        certifications: row.certifications ?? [],
        certification_dates: row.certification_dates ?? {},
        primary_naics: row.primary_naics,
        naics_codes: row.naics_codes ?? [],
        capability_narrative: row.capability_narrative,
        differentiators: row.differentiators ?? [],
        bonding_capacity_single_usd: row.bonding_capacity_single_usd
          ? Number(row.bonding_capacity_single_usd)
          : null,
        bonding_capacity_aggregate_usd: row.bonding_capacity_aggregate_usd
          ? Number(row.bonding_capacity_aggregate_usd)
          : null,
        bonding_company: row.bonding_company,
        professional_liability_usd: row.professional_liability_usd
          ? Number(row.professional_liability_usd)
          : null,
        general_liability_usd: row.general_liability_usd
          ? Number(row.general_liability_usd)
          : null,
        employee_count_range: row.employee_count_range,
        annual_revenue: row.annual_revenue ?? [],
        states_active: row.states_active ?? [],
        gsa_regions: row.gsa_regions ?? [],
        total_contracts_completed: row.total_contracts_completed,
        total_contract_value_usd: row.total_contract_value_usd
          ? Number(row.total_contract_value_usd)
          : null,
        facilities: row.facilities ?? [],
        equipment: row.equipment ?? [],
        clearance_counts: row.clearance_counts ?? {},
        awards: row.awards ?? [],
        vouching_contacts: row.vouching_contacts ?? [],
      }
    : undefined

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Capability Statement</h1>
      <p className="text-sm text-gray-500 mb-8">
        Your firm&rsquo;s evergreen identity. Auto-populates the boilerplate sections
        of every proposal — company info, certifications, NAICS, bonding, key
        capabilities. Update once; it flows everywhere.
      </p>

      <CapabilityStatementForm
        initial={initial}
        saved={params.saved === '1'}
        onSubmit={upsertCapabilityStatement}
      />
    </main>
  )
}
