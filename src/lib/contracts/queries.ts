import { createClient } from '@/lib/supabase/server'
import type { Contract, ContractWithDeliverables } from './types'

export async function getContracts(): Promise<Contract[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('period_end', { ascending: true })
  if (error) throw error
  return (data ?? []) as Contract[]
}

export async function getContract(id: string): Promise<ContractWithDeliverables | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contracts')
    .select('*, contract_deliverables(*)')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as ContractWithDeliverables
}

export async function getContractByProposalId(proposalId: string): Promise<Contract | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contracts')
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle()
  return data as Contract | null
}
