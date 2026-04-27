'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'

export async function assignRequirement(
  proposalId: string,
  requirementId: string,
  assigneeId: string | null,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('requirement_assignments' as any)
      .upsert(
        {
          proposal_id: proposalId,
          requirement_id: requirementId,
          assignee_id: assigneeId,
          status: 'pending',
        },
        { onConflict: 'proposal_id,requirement_id' },
      )

    if (error) {
      console.error('[assignRequirement] upsert error:', error.message)
    }
  } catch (err) {
    console.error('[assignRequirement] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/tasks`)
}

export async function updateRequirementStatus(
  proposalId: string,
  requirementId: string,
  status: 'pending' | 'in_progress' | 'complete',
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('requirement_assignments' as any)
      .upsert(
        {
          proposal_id: proposalId,
          requirement_id: requirementId,
          status,
        },
        { onConflict: 'proposal_id,requirement_id' },
      )

    if (error) {
      console.error('[updateRequirementStatus] upsert error:', error.message)
    }
  } catch (err) {
    console.error('[updateRequirementStatus] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/tasks`)
}
