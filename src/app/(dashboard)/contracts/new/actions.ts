'use server'
import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'

export async function createContract(formData: FormData) {
  const user = await getUser()
  if (!user) throw new Error('Unauthenticated')

  const supabase = await createClient()

  const rawBaseValue = formData.get('base_value') as string
  const rawCeilingValue = formData.get('ceiling_value') as string

  const { data, error } = await supabase.from('contracts').insert({
    user_id: user.id,
    proposal_id: (formData.get('proposal_id') as string) || null,
    title: formData.get('title') as string,
    contract_number: (formData.get('contract_number') as string) || null,
    agency: (formData.get('agency') as string) || null,
    contracting_officer_name: (formData.get('contracting_officer_name') as string) || null,
    contracting_officer_email: (formData.get('contracting_officer_email') as string) || null,
    co_phone: (formData.get('co_phone') as string) || null,
    place_of_performance: (formData.get('place_of_performance') as string) || null,
    naics_code: (formData.get('naics_code') as string) || null,
    set_aside: (formData.get('set_aside') as string) || null,
    base_value: rawBaseValue ? Math.round(parseFloat(rawBaseValue) * 100) : null,
    ceiling_value: rawCeilingValue ? Math.round(parseFloat(rawCeilingValue) * 100) : null,
    award_date: (formData.get('award_date') as string) || null,
    period_start: (formData.get('period_start') as string) || null,
    period_end: (formData.get('period_end') as string) || null,
    period_end_with_options: (formData.get('period_end_with_options') as string) || null,
    status: 'active',
    notes: (formData.get('notes') as string) || null,
  }).select('id').single()

  if (error) throw new Error(error.message)
  redirect(`/contracts/${data.id}`)
}
