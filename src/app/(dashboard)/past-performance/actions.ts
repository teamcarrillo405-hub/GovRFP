'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'
import {
  pastPerformanceInputSchema,
  type PastPerformanceInput,
} from '@/lib/past-performance/types'

/**
 * Past Performance library server actions.
 *
 * All three actions use the user-scoped supabase client so RLS enforces
 * access: solo rows for the current user OR team rows for teams the user
 * belongs to (via the pp_user_team_ids SECURITY DEFINER helper).
 *
 * Team auto-assignment (future): when a user has exactly one team, we can
 * default team_id to that. For V1 we leave it to the form — the server
 * just validates the shape.
 */

export async function createPastPerformance(input: PastPerformanceInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const parsed = pastPerformanceInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid past-performance payload: ${parsed.error.issues[0]?.message}`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('past_performance')
    .insert({
      ...parsed.data,
      user_id: user.id,
      // Empty-string email coerced to null (zod lets '' through)
      customer_poc_email: parsed.data.customer_poc_email || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create past-performance record: ${error?.message ?? 'unknown'}`)
  }

  revalidatePath('/past-performance')
  redirect(`/past-performance/${data.id}`)
}

export async function updatePastPerformance(id: string, input: PastPerformanceInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const parsed = pastPerformanceInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid past-performance payload: ${parsed.error.issues[0]?.message}`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('past_performance')
    .update({
      ...parsed.data,
      customer_poc_email: parsed.data.customer_poc_email || null,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update past-performance record: ${error.message}`)
  }

  revalidatePath('/past-performance')
  revalidatePath(`/past-performance/${id}`)
  redirect('/past-performance')
}

export async function deletePastPerformance(id: string) {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { error } = await supabase.from('past_performance').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete past-performance record: ${error.message}`)
  }

  revalidatePath('/past-performance')
  redirect('/past-performance')
}
