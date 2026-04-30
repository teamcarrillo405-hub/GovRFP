// Pure types + helpers for saved searches. Safe to import from client components.

export interface OpportunityFilters {
  q?: string
  naics?: string
  set_aside?: string
  state?: string
  deadline_from?: string
  deadline_to?: string
  agency?: string
  page?: number
}

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  filters: OpportunityFilters
  alerts_enabled: boolean
  last_alerted_at: string | null
  created_at: string
  updated_at: string
}

export interface SavedSearchInput {
  name: string
  filters: OpportunityFilters
  alerts_enabled?: boolean
}

export function paramsToFilters(params: URLSearchParams): OpportunityFilters {
  const f: OpportunityFilters = {}
  const get = (k: string) => params.get(k)?.trim() || undefined
  f.q = get('q')
  f.naics = get('naics')
  f.set_aside = get('set_aside')
  f.state = get('state')
  f.deadline_from = get('deadline_from')
  f.deadline_to = get('deadline_to')
  f.agency = get('agency')
  return f
}

export function summarizeFilters(filters: OpportunityFilters): string {
  const parts: string[] = []
  if (filters.q) parts.push(`"${filters.q}"`)
  if (filters.naics) parts.push(`NAICS ${filters.naics}`)
  if (filters.set_aside) parts.push(filters.set_aside)
  if (filters.state) parts.push(filters.state)
  if (filters.agency) parts.push(filters.agency)
  if (filters.deadline_from || filters.deadline_to) {
    parts.push(`due ${filters.deadline_from ?? '…'} to ${filters.deadline_to ?? '…'}`)
  }
  return parts.length ? parts.join(' · ') : 'All opportunities'
}
