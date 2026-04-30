export type ContractStatus = 'active' | 'expiring' | 'expired' | 'complete' | 'terminated'
export type DeliverableStatus = 'pending' | 'submitted' | 'accepted' | 'overdue'
export type DeliverableFrequency = 'oneshot' | 'weekly' | 'monthly' | 'quarterly' | 'annual'

export interface Contract {
  id: string
  user_id: string
  team_id: string | null
  proposal_id: string | null
  title: string
  contract_number: string | null
  agency: string | null
  contracting_officer_name: string | null
  contracting_officer_email: string | null
  co_phone: string | null
  place_of_performance: string | null
  naics_code: string | null
  set_aside: string | null
  base_value: number | null
  ceiling_value: number | null
  award_date: string | null
  period_start: string | null
  period_end: string | null
  period_end_with_options: string | null
  status: ContractStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ContractDeliverable {
  id: string
  contract_id: string
  title: string
  description: string | null
  due_date: string | null
  frequency: DeliverableFrequency | null
  status: DeliverableStatus
  submitted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ContractWithDeliverables extends Contract {
  contract_deliverables: ContractDeliverable[]
}

export function fmtContractValue(cents: number | null): string {
  if (cents === null) return '\u2014'
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`
  return `$${dollars.toLocaleString()}`
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export function deriveStatus(contract: Contract): ContractStatus {
  if (contract.status !== 'active') return contract.status
  const days = daysUntil(contract.period_end)
  if (days === null) return 'active'
  if (days < 0) return 'expired'
  if (days <= 90) return 'expiring'
  return 'active'
}
