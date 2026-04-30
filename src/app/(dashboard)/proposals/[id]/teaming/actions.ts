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

  const partnerName = (formData.get('partner_name') as string | null)?.trim() ?? ''
  if (!partnerName) return

  const role = (formData.get('role') as string | null) ?? 'Subcontractor'
  const workshareRaw = formData.get('workshare_pct')
  const worksharePct =
    workshareRaw !== null && workshareRaw !== ''
      ? parseFloat(workshareRaw as string)
      : 0

  // naics_codes: comma-separated string → array of trimmed non-empty strings
  const naicsRaw = (formData.get('naics_codes') as string | null) ?? ''
  const naicsCodes = naicsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // sba_certifications: multi-value checkboxes → array
  const sbaCerts = formData.getAll('sba_certifications').map((v) => v as string)

  const contactEmail = (formData.get('contact_email') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('teaming_partners' as any)
      .insert({
        proposal_id: proposalId,
        user_id: user.id,
        partner_name: partnerName,
        role,
        workshare_pct: worksharePct,
        naics_codes: naicsCodes,
        sba_certifications: sbaCerts,
        contact_email: contactEmail,
        notes,
      })

    if (error) {
      console.error('[addTeamingPartner] insert error:', error.message)
    }
  } catch (err) {
    console.error('[addTeamingPartner] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/teaming`)
}

export async function updateTeamingPartner(
  partnerId: string,
  proposalId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const partnerName = (formData.get('partner_name') as string | null)?.trim() ?? ''
  if (!partnerName) return

  const role = (formData.get('role') as string | null) ?? 'Subcontractor'
  const workshareRaw = formData.get('workshare_pct')
  const worksharePct =
    workshareRaw !== null && workshareRaw !== ''
      ? parseFloat(workshareRaw as string)
      : 0

  const naicsRaw = (formData.get('naics_codes') as string | null) ?? ''
  const naicsCodes = naicsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const sbaCerts = formData.getAll('sba_certifications').map((v) => v as string)

  const contactEmail = (formData.get('contact_email') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('teaming_partners' as any)
      .update({
        partner_name: partnerName,
        role,
        workshare_pct: worksharePct,
        naics_codes: naicsCodes,
        sba_certifications: sbaCerts,
        contact_email: contactEmail,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partnerId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[updateTeamingPartner] update error:', error.message)
    }
  } catch (err) {
    console.error('[updateTeamingPartner] unexpected error:', err)
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
      .eq('user_id', user.id)

    if (error) {
      console.error('[deleteTeamingPartner] delete error:', error.message)
    }
  } catch (err) {
    console.error('[deleteTeamingPartner] unexpected error:', err)
  }

  revalidatePath(`/proposals/${proposalId}/teaming`)
}
