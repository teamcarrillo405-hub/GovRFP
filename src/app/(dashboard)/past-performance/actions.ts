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
 * Team auto-assignment: on create, if the user belongs to exactly one team
 * that team's id is stored on the record so all team members can see it.
 * Users with zero or multiple teams get team_id = null (safe solo behavior).
 */

/** Resolves the team_id to assign on a new record for the given user.
 *  Returns the team's UUID when the user is in exactly one team, otherwise null.
 *  Never throws — errors default to null so record creation is never blocked. */
async function resolveTeamId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  try {
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(5)

    if (error || !memberships) return null
    return memberships.length === 1 ? (memberships[0].team_id as string) : null
  } catch {
    return null
  }
}

export async function createPastPerformance(input: PastPerformanceInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const parsed = pastPerformanceInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid past-performance payload: ${parsed.error.issues[0]?.message}`)
  }

  const supabase = await createClient()

  // Auto-scope to the user's team when they belong to exactly one.
  const teamId = await resolveTeamId(supabase, user.id)

  const { data, error } = await supabase
    .from('past_performance')
    .insert({
      ...parsed.data,
      user_id: user.id,
      team_id: teamId,
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

  // Exclude team_id from the update payload — it is set on creation only and
  // must never be overwritten by a form submission (the form has no team_id
  // field, so parsed.data.team_id would be undefined, which would clear it).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { team_id: _ignored, ...updateFields } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('past_performance')
    .update({
      ...updateFields,
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

export async function bulkCreatePastPerformance(
  inputs: PastPerformanceInput[],
): Promise<{ created: number }> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Auto-scope bulk records to the user's team when they belong to exactly one.
  const teamId = await resolveTeamId(supabase, user.id)

  const rows = inputs
    .map((input) => pastPerformanceInputSchema.safeParse(input))
    .filter((r) => r.success)
    .map((r) => ({
      ...(r as { success: true; data: PastPerformanceInput }).data,
      user_id: user.id,
      team_id: teamId,
      customer_poc_email:
        (r as { success: true; data: PastPerformanceInput }).data.customer_poc_email || null,
    }))

  if (rows.length === 0) return { created: 0 }

  const { error } = await supabase.from('past_performance').insert(rows)

  if (error) {
    throw new Error(`Failed to bulk-create past-performance records: ${error.message}`)
  }

  revalidatePath('/past-performance')
  // Caller handles navigation — no redirect here.
  return { created: rows.length }
}
