export interface SbirAward {
  awardId: string
  program: 'SBIR' | 'STTR'
  phase: 'Phase I' | 'Phase II' | 'Phase IIB'
  title: string
  agency: string
  awardAmount: number
  awardYear: number
  companyName: string
  abstract: string
  keywords: string[]
}
