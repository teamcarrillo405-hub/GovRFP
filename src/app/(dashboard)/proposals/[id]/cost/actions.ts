'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, createClient } from '@/lib/supabase/server'

export async function addCostItem(
  proposalId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const laborCategory = (formData.get('labor_category') as string | null)?.trim() ?? ''
  const costType = (formData.get('cost_type') as string | null) ?? 'direct'
  const ratePerHour = parseFloat((formData.get('rate_per_hour') as string | null) ?? '0') || 0
  const hours = parseFloat((formData.get('hours') as string | null) ?? '0') || 0
  const periodOfPerformance = (formData.get('period_of_performance') as string | null)?.trim() || null
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!laborCategory) return

  const { error } = await supabase
    .from('proposal_cost_items' as any)
    .insert({
      proposal_id: proposalId,
      user_id: user.id,
      labor_category: laborCategory,
      cost_type: costType,
      rate_per_hour: ratePerHour,
      hours,
      period_of_performance: periodOfPerformance,
      notes,
      sort_order: Date.now(),
    })

  if (error) {
    console.error('[addCostItem] error:', error.message)
  }

  revalidatePath('/proposals/' + proposalId + '/cost')
}

export async function deleteCostItem(
  itemId: string,
  proposalId: string,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { error } = await supabase
    .from('proposal_cost_items' as any)
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[deleteCostItem] error:', error.message)
  }

  revalidatePath('/proposals/' + proposalId + '/cost')
}

export async function saveCostSettings(
  proposalId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const feePct = parseFloat((formData.get('fee_pct') as string | null) ?? '10') || 10
  const overheadRate = parseFloat((formData.get('overhead_rate') as string | null) ?? '0') || 0
  const gAndARate = parseFloat((formData.get('g_and_a_rate') as string | null) ?? '0') || 0

  const { error } = await supabase
    .from('proposal_cost_settings' as any)
    .upsert(
      {
        proposal_id: proposalId,
        user_id: user.id,
        fee_pct: feePct,
        overhead_rate: overheadRate,
        g_and_a_rate: gAndARate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'proposal_id' },
    )

  if (error) {
    console.error('[saveCostSettings] error:', error.message)
  }

  revalidatePath('/proposals/' + proposalId + '/cost')
}
