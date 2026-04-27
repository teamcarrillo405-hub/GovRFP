'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'

export async function savePrevailingWageInputs(
  proposalId: string,
  formData: {
    state: string
    county: string
    construction_type: string
    wd_number: string
    notes: string
  },
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  try {
    const { error } = await (supabase as any)
      .from('prevailing_wage_inputs')
      .upsert(
        {
          proposal_id: proposalId,
          state: formData.state,
          county: formData.county,
          construction_type: formData.construction_type,
          wd_number: formData.wd_number,
          notes: formData.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'proposal_id' },
      )

    if (error) {
      console.error('[savePrevailingWageInputs] upsert error:', error.message)
      return { success: false, error: error.message }
    }
  } catch (err) {
    console.error('[savePrevailingWageInputs] unexpected error:', err)
    return { success: false, error: 'Unexpected error saving wage inputs.' }
  }

  revalidatePath(`/proposals/${proposalId}/prevailing-wage`)
  return { success: true }
}
