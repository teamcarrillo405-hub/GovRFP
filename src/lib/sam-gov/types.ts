export interface SamGovOpportunity {
  noticeId: string
  title: string
  solicitationNumber?: string
  fullParentPathName?: string  // agency path
  organizationName?: string
  naicsCode?: string
  typeOfSetAsideDescription?: string
  placeOfPerformance?: {
    state?: { code?: string; name?: string }
    city?: { name?: string }
  }
  responseDeadLine?: string
  postedDate?: string
  link?: string
  description?: string
  estimatedValueLow?: number
  estimatedValueHigh?: number
}

export interface SamGovApiResponse {
  totalRecords: number
  opportunitiesData: SamGovOpportunity[]
}

export interface NormalizedOpportunity {
  solicitation_number: string | null
  notice_id: string
  title: string
  agency: string | null
  office: string | null
  naics_code: string | null
  set_aside: string | null
  place_of_performance_state: string | null
  place_of_performance_city: string | null
  estimated_value: number | null
  posted_date: string | null
  due_date: string | null
  active: boolean
  sam_url: string | null
  description: string | null
  match_score: number | null
}
