'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'

export async function addTeamingPartner(
  proposalId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const companyName = (formData.get('company_name') as string | null)?.trim() ?? ''
  if (!companyName) return

  const role = (formData.get('role') as string | null) ?? 'subcontractor'
  const certification = (formData.get('certification') as string | null) ?? 'none'
  const workShareRaw = formData.get('work_share_pct')
  const workSharePct = workShareRaw !== null && workShareRaw !== '' ? parseInt(workShareRaw as string, 10) : null
  const pointOfContact = (formData.get('point_of_contact') as string | null)?.trim() ?? null
  const email = (formData.get('email') as string | null)?.trim() ?? null
  const notes = (formData.get('notes') as string | null)?.trim() ?? null

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('teaming_partners' as any)
      .insert({
        proposal_id: proposalId,
        company_name: companyName,
        role,
        certification,
        work_share_pct: workSharePct,
        point_of_contact: pointOfContact || null,
        email: email || null,
        notes: notes || null,
        status: 'prospect',
      })

    if (error) {
      console.error('[addTeamingPartner] insert error:', error.message)
    }
  } catch (err) {
    console.error('[addTeamingPartner] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/teaming`)
}

export async function deleteTeamingPartner(
  partnerId: string,
  proposalId: string,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('teaming_partners' as any)
      .delete()
      .eq('id', partnerId)
      .eq('proposal_id', proposalId)

    if (error) {
      console.error('[deleteTeamingPartner] delete error:', error.message)
    }
  } catch (err) {
    console.error('[deleteTeamingPartner] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/teaming`)
}
