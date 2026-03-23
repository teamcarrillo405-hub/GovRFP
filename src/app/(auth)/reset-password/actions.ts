'use server'
import { createClient } from '@/lib/supabase/server'

export async function resetPasswordAction(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email is required' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_URL}/update-password`,
  })

  if (error) return { error: error.message }
  return { success: true }
}
