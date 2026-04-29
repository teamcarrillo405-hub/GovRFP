'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { profileSchema } from '@/lib/validators/profile'
import { revalidatePath } from 'next/cache'

function parseDollarAmount(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null
  const cleaned = parseInt(value.replace(/[^0-9]/g, ''), 10)
  return isNaN(cleaned) ? null : cleaned
}

function parseIntField(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null
  const parsed = parseInt(value.trim(), 10)
  return isNaN(parsed) ? null : parsed
}

export async function updateProfile(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const sbaSizeRaw = formData.get('sba_size_category') as string | null
  const sbaSize = sbaSizeRaw === 'small' || sbaSizeRaw === 'other_than_small' ? sbaSizeRaw : null

  const raw = {
    company_name: formData.get('company_name') as string,
    uei_cage: formData.get('uei_cage') as string,
    certifications: formData.getAll('certifications') as string[],
    naics_codes: ((formData.get('naics_codes') as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    capability_statement: formData.get('capability_statement') as string,

    // Business capacity
    annual_revenue_usd: parseDollarAmount(formData.get('annual_revenue_usd')),
    bonding_single_usd: parseDollarAmount(formData.get('bonding_single_usd')),
    bonding_aggregate_usd: parseDollarAmount(formData.get('bonding_aggregate_usd')),
    surety_company: (formData.get('surety_company') as string) || '',
    max_project_size_usd: parseDollarAmount(formData.get('max_project_size_usd')),
    employee_count: parseIntField(formData.get('employee_count')),
    years_in_business: parseIntField(formData.get('years_in_business')),
    sam_gov_registered: formData.get('sam_gov_registered') === 'on',

    // Business type
    construction_types: formData.getAll('construction_types') as string[],
    sba_size_category: sbaSize,

    // Geography
    primary_state: (formData.get('primary_state') as string) || '',
    geographic_states: formData.getAll('geographic_states') as string[],

    // Onboarding
    onboarding_completed: formData.get('onboarding_completed') === 'on',

    // Website & identity
    website_url: (formData.get('website_url') as string) || '',
    differentiators: (formData.get('differentiators') as string) || '',
    emr: (() => {
      const v = formData.get('emr') as string
      if (!v || v.trim() === '') return null
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    })(),
  }

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function getProfile() {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  // Cast required: new columns from migration 00019 not yet in generated types
  const { data } = await (supabase as any)
    .from('profiles')
    .select(
      'company_name, uei_cage, certifications, naics_codes, capability_statement, ' +
      'annual_revenue_usd, bonding_single_usd, bonding_aggregate_usd, surety_company, ' +
      'max_project_size_usd, employee_count, years_in_business, sam_gov_registered, ' +
      'construction_types, sba_size_category, primary_state, geographic_states, onboarding_completed, ' +
      'website_url, differentiators, emr'
    )
    .eq('id', user.id)
    .single()

  return data as Record<string, unknown> | null
}
