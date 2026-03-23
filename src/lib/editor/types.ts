import type { JSONContent } from '@tiptap/react'

export const SECTION_NAMES = [
  'Executive Summary',
  'Technical Approach',
  'Management Plan',
  'Past Performance',
  'Price Narrative',
] as const

export type SectionName = typeof SECTION_NAMES[number]

export type DraftStatus = 'empty' | 'generating' | 'draft' | 'edited'

export interface ProposalSection {
  id: string
  proposal_id: string
  user_id: string
  section_name: SectionName
  content: JSONContent
  draft_status: DraftStatus
  last_saved_at: string | null
  tokens_used: number | null
  created_at: string
  updated_at: string
}

export interface DraftRequest {
  section: SectionName
  instruction?: string
}

export interface SaveSectionRequest {
  content: JSONContent
  draft_status: DraftStatus
}

export type ComplianceCoverage = Map<string, 'addressed' | 'partial' | 'unaddressed'>
