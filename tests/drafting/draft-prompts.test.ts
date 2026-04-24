import { describe, it, expect } from 'vitest'
import { buildSectionPrompt } from '@/lib/editor/draft-prompts'
import type { AnalysisRequirement } from '@/lib/analysis/types'

// Mock data
const mockProfile = {
  company_name: 'HCC Test Corp',
  certifications: ['8(a)', 'HUBZone'],
  naics_codes: ['236220'],
  capability_statement: 'Test capability statement',
}

const mockPastProjects = [
  {
    agency: 'Department of Defense',
    scope_narrative: 'Construction management services for military housing renovation project',
    contract_value: 5000000,
    outcome: 'Completed on time and within budget',
    period_start: '2022-01-01',
    period_end: '2023-06-30',
  },
  {
    agency: 'General Services Administration',
    scope_narrative: 'Federal office building renovation and modernization',
    contract_value: 3500000,
    outcome: 'Excellent CPARS rating, all deliverables met',
    period_start: '2021-03-01',
    period_end: '2022-09-30',
  },
]

const mockKeyPersonnel = [
  {
    name: 'Jane Smith',
    title: 'Project Manager',
    experience: 'PMP certified with 10 years of federal construction management experience',
  },
  {
    name: 'John Doe',
    title: 'Lead Engineer',
    experience: 'PE licensed structural engineer specializing in federal facility renovations',
  },
]

const mockRfpText = 'The contractor shall provide construction management services for the federal facility renovation project...'

const mockRequirements: AnalysisRequirement[] = [
  {
    id: 'REQ-001',
    text: 'The contractor shall provide BIM-based project management',
    classification: 'mandatory',
    keyword: 'shall',
    section_ref: 'SOW 3.1',
    proposal_topic: 'Technical',
  },
  {
    id: 'REQ-002',
    text: 'The contractor shall assign a qualified Project Manager',
    classification: 'mandatory',
    keyword: 'shall',
    section_ref: 'SOW 4.1',
    proposal_topic: 'Management',
  },
  {
    id: 'REQ-003',
    text: 'The contractor shall provide past performance references',
    classification: 'mandatory',
    keyword: 'shall',
    section_ref: 'SOW 5.1',
    proposal_topic: 'Past Performance',
  },
]

describe('buildSectionPrompt', () => {
  it('injects company_name and certifications for Executive Summary', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).toContain('HCC Test Corp')
    expect(firstBlock.text).toContain('8(a)')
    expect(firstBlock.text).toContain('HUBZone')
  })

  it('injects capability_statement for Executive Summary', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).toContain('Test capability statement')
  })

  it('injects RFP technical requirements for Technical Approach', () => {
    const result = buildSectionPrompt(
      'Technical Approach',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    // Technical requirement should appear
    expect(firstBlock.text).toContain('BIM-based project management')
    // Management requirement should NOT appear in Technical section
    expect(firstBlock.text).not.toContain('assign a qualified Project Manager')
  })

  it('injects key personnel bios for Management Plan', () => {
    const result = buildSectionPrompt(
      'Management Plan',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).toContain('Jane Smith')
    expect(firstBlock.text).toContain('Project Manager')
    expect(firstBlock.text).toContain('John Doe')
    expect(firstBlock.text).toContain('Lead Engineer')
  })

  it('injects matched past projects for Executive Summary (past performance topic)', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    // Executive Summary references past project summaries
    expect(firstBlock.text).toContain('Past Projects')
  })

  it('generates a Project Schedule prompt covering scheduling approach', () => {
    const result = buildSectionPrompt(
      'Project Schedule',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).toContain('Project Schedule')
    expect(firstBlock.text).toContain('milestones')
  })

  it('includes instruction string when provided', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements,
      'Focus on our small business advantage'
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).toContain('Special instruction: Focus on our small business advantage')
  })

  it('omits instruction block when not provided', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    const firstBlock = result[0] as { type: string; text: string }
    expect(firstBlock.text).not.toContain('Special instruction')
  })

  it('sets cache_control ephemeral on RFP text block', () => {
    const result = buildSectionPrompt(
      'Executive Summary',
      mockProfile,
      mockPastProjects,
      mockKeyPersonnel,
      mockRfpText,
      mockRequirements
    )
    expect(result.length).toBeGreaterThanOrEqual(2)
    const secondBlock = result[1] as { type: string; text: string; cache_control: { type: string } }
    expect(secondBlock.cache_control).toEqual({ type: 'ephemeral' })
    expect(secondBlock.text).toContain(mockRfpText)
  })
})
