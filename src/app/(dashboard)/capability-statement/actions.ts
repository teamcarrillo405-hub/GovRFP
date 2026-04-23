'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'
import {
  capabilityStatementInputSchema,
  type CapabilityStatementInput,
} from '@/lib/capability-statement/types'

/**
 * Capability Statement server actions.
 *
 * One row per team OR per solo user (enforced by partial unique indexes
 * in migration 00007). upsert reads first, then insert OR update — no
 * Postgres ON CONFLICT because the partial unique constraints don't have
 * a single key to target.
 */

export async function upsertCapabilityStatement(input: CapabilityStatementInput) {
  const user = await getUser()
  if (!user) redirect('/login')

  const parsed = capabilityStatementInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid capability-statement payload: ${parsed.error.issues[0]?.message}`)
  }

  const supabase = await createClient()

  const data = {
    ...parsed.data,
    primary_contact_email: parsed.data.primary_contact_email || null,
    website_url: parsed.data.website_url || null,
    hq_state: parsed.data.hq_state || null,
  }

  // Look for existing row (RLS scopes naturally to user/team)
  const teamId = parsed.data.team_id ?? null
  const lookup = teamId
    ? supabase.from('capability_statements').select('id').eq('team_id', teamId).maybeSingle()
    : supabase
        .from('capability_statements')
        .select('id')
        .eq('user_id', user.id)
        .is('team_id', null)
        .maybeSingle()

  const { data: existing, error: lookupErr } = await lookup
  if (lookupErr) {
    throw new Error(`Capability statement lookup failed: ${lookupErr.message}`)
  }

  if (existing) {
    const { error } = await supabase
      .from('capability_statements')
      .update(data)
      .eq('id', existing.id)
    if (error) throw new Error(`Update failed: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('capability_statements')
      .insert({ ...data, user_id: user.id })
    if (error) throw new Error(`Insert failed: ${error.message}`)
  }

  revalidatePath('/capability-statement')
  redirect('/capability-statement?saved=1')
}

export async function deleteCapabilityStatement() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  // Solo only — deleting a team's capability statement should be a separate confirmed flow
  const { error } = await supabase
    .from('capability_statements')
    .delete()
    .eq('user_id', user.id)
    .is('team_id', null)
  if (error) throw new Error(`Delete failed: ${error.message}`)

  revalidatePath('/capability-statement')
  redirect('/capability-statement')
}
