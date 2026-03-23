'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { keyPersonnelSchema } from '@/lib/validators/profile'
import { revalidatePath } from 'next/cache'

export async function getKeyPersonnel() {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('key_personnel')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function createKeyPersonnel(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = {
    name: formData.get('name') as string,
    title: formData.get('title') as string,
    experience: formData.get('experience') as string,
    certifications: ((formData.get('certifications') as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }

  const parsed = keyPersonnelSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('key_personnel')
    .insert({ ...parsed.data, user_id: user.id })

  if (error) return { error: error.message }
  revalidatePath('/profile/key-personnel')
  return { success: true }
}

export async function updateKeyPersonnel(id: string, formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw = {
    name: formData.get('name') as string,
    title: formData.get('title') as string,
    experience: formData.get('experience') as string,
    certifications: ((formData.get('certifications') as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }

  const parsed = keyPersonnelSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('key_personnel')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile/key-personnel')
  return { success: true }
}

export async function deleteKeyPersonnel(id: string) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('key_personnel')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile/key-personnel')
  return { success: true }
}
