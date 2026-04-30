'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import type { ContractDeliverable } from '@/lib/contracts/types'

export async function updateDeliverableStatus(
  id: string,
  status: ContractDeliverable['status'],
) {
  const user = await getUser()
  if (!user) throw new Error('Unauthenticated')
  const supabase = await createClient()
  const { error } = await supabase
    .from('contract_deliverables')
    .update({ status, submitted_at: status === 'submitted' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contracts/[id]', 'page')
}

export async function addDeliverable(contractId: string, formData: FormData) {
  const user = await getUser()
  if (!user) throw new Error('Unauthenticated')
  const supabase = await createClient()
  await supabase.from('contract_deliverables').insert({
    contract_id: contractId,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    due_date: (formData.get('due_date') as string) || null,
    frequency: (formData.get('frequency') as ContractDeliverable['frequency']) || null,
    status: 'pending',
  })
  revalidatePath(`/contracts/${contractId}`)
}

export async function completeContract(id: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthenticated')
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (contract) {
    await supabase.from('contracts').update({ status: 'complete' }).eq('id', id)

    if (contract.proposal_id) {
      const existing = await supabase
        .from('past_performance')
        .select('id')
        .eq('source_proposal_id', contract.proposal_id)
        .maybeSingle()

      if (!existing.data) {
        await supabase.from('past_performance').insert({
          user_id: user.id,
          team_id: contract.team_id,
          source_proposal_id: contract.proposal_id,
          contract_title: contract.title,
          contract_number: contract.contract_number,
          customer_name: contract.agency ?? 'Unknown',
          period_start: contract.period_start,
          period_end: contract.period_end,
          contract_value_usd: contract.base_value ? contract.base_value / 100 : null,
          naics_codes: contract.naics_code ? [contract.naics_code] : [],
          set_asides_claimed: contract.set_aside ? [contract.set_aside] : [],
        })
      }
    }
  }

  revalidatePath(`/contracts/${id}`)
}

export async function deleteContract(id: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthenticated')
  const supabase = await createClient()
  await supabase.from('contracts').delete().eq('id', id)
  redirect('/contracts')
}
