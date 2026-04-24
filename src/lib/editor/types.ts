import type { JSONContent } from '@tiptap/react'

export const SECTION_NAMES = [
  'Cover Letter',
  'Executive Summary',
  'Technical Approach',
  'Management Plan',
  'Staffing Plan',
  'Quality Control Plan',
  'Safety Plan',
  'Project Schedule',
] as const

export type SectionName = typeof SECTION_NAMES[number]

export interface CustomTemplateSection {
  id: string        // slug, e.g. "c1-scope-of-work"
  title: string     // e.g. "C.1 Scope of Work"
  pageHint?: string // e.g. "Page 12" from original doc
  required: boolean
}

export type DraftStatus = 'empty' | 'generating' | 'scoring' | 'draft' | 'edited'

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
