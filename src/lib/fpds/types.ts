export interface FpdsAward {
  awardId: string
  contractId: string
  agencyName: string
  awardeeUei: string
  awardeeName: string
  awardAmount: number
  awardDate: string       // ISO date
  completionDate: string  // ISO date
  description: string
  naicsCode: string
  setAside: string | null
  solicitationId: string | null
  placeOfPerformanceState: string | null
  isIncumbent: boolean    // true if this awardee might be incumbent based on timing
}

export interface FpdsSearchResult {
  awards: FpdsAward[]
  totalCount: number
  source: 'fpds'
}
