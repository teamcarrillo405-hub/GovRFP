'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { pastProjectSchema } from '@/lib/validators/profile'
import { revalidatePath } from 'next/cache'

export async function getPastProjects() {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('past_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function createPastProject(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const contractValueStr = formData.get('contract_value') as string
  const contractValueDollars = contractValueStr ? parseFloat(contractValueStr) : undefined
  const contractValueCents =
    contractValueDollars !== undefined && !isNaN(contractValueDollars)
      ? Math.round(contractValueDollars * 100)
      : undefined

  const raw = {
    contract_number: formData.get('contract_number') as string,
    agency: formData.get('agency') as string,
    contract_value: contractValueCents,
    period_start: formData.get('period_start') as string,
    period_end: formData.get('period_end') as string,
    scope_narrative: formData.get('scope_narrative') as string,
    naics_code: formData.get('naics_code') as string,
    outcome: formData.get('outcome') as string,
  }

  const parsed = pastProjectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('past_projects')
    .insert({ ...parsed.data, user_id: user.id })

  if (error) return { error: error.message }
  revalidatePath('/profile/past-projects')
  return { success: true }
}

export async function updatePastProject(id: string, formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const contractValueStr = formData.get('contract_value') as string
  const contractValueDollars = contractValueStr ? parseFloat(contractValueStr) : undefined
  const contractValueCents =
    contractValueDollars !== undefined && !isNaN(contractValueDollars)
      ? Math.round(contractValueDollars * 100)
      : undefined

  const raw = {
    contract_number: formData.get('contract_number') as string,
    agency: formData.get('agency') as string,
    contract_value: contractValueCents,
    period_start: formData.get('period_start') as string,
    period_end: formData.get('period_end') as string,
    scope_narrative: formData.get('scope_narrative') as string,
    naics_code: formData.get('naics_code') as string,
    outcome: formData.get('outcome') as string,
  }

  const parsed = pastProjectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('past_projects')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile/past-projects')
  return { success: true }
}

export async function deletePastProject(id: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('past_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile/past-projects')
  return { success: true }
}
