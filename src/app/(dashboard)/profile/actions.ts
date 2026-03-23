'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { profileSchema } from '@/lib/validators/profile'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = {
    company_name: formData.get('company_name') as string,
    uei_cage: formData.get('uei_cage') as string,
    certifications: formData.getAll('certifications') as string[],
    naics_codes: ((formData.get('naics_codes') as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    capability_statement: formData.get('capability_statement') as string,
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
  const { data } = await supabase
    .from('profiles')
    .select('company_name, uei_cage, certifications, naics_codes, capability_statement')
    .eq('id', user.id)
    .single()

  return data
}
