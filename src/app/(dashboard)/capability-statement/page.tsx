import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { CapabilityStatementForm } from '@/components/capability-statement/CapabilityStatementForm'
import { upsertCapabilityStatement } from '@/app/(dashboard)/capability-statement/actions'
import type { CapabilityStatementInput } from '@/lib/capability-statement/types'

interface SearchParams {
  saved?: string
}

export default async function CapabilityStatementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('capability_statements')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
          Capability Statement
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.55)', marginTop: 6 }}>
          Your firm&rsquo;s evergreen identity. Auto-populates the boilerplate sections
          of every proposal — company info, certifications, NAICS, bonding, key
          capabilities. Update once; it flows everywhere.
        </p>
      </div>

      <CapabilityStatementForm
        initial={initial}
        saved={params.saved === '1'}
        onSubmit={upsertCapabilityStatement}
      />
    </div>
  )
}
