import { describe, it, expect } from 'vitest'
import { scanCompliance, extractText } from '@/lib/editor/compliance-scanner'
import type { AnalysisRequirement } from '@/lib/analysis/types'
import type { JSONContent } from '@tiptap/react'

// Helpers
function makeParagraphDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function makeReq(overrides: Partial<AnalysisRequirement> = {}): AnalysisRequirement {
  return {
    id: 'REQ-001',
    text: 'The contractor shall provide construction management services for federal buildings',
    classification: 'mandatory',
    keyword: 'shall',
    section_ref: 'C.1',
    proposal_topic: 'Technical',
    ...overrides,
  }
}

describe('extractText', () => {
  it('extracts text from nested Tiptap JSON', () => {
    const doc = makeParagraphDoc('hello world')
    expect(extractText(doc)).toContain('hello world')
  })
})

describe('scanCompliance', () => {
  it('returns addressed when 60%+ keywords present', () => {
    // requirement text: "The contractor shall provide construction management services for federal buildings"
    // 4+ letter keywords: contractor, shall, provide, construction, management, services, federal, buildings
    // document contains all of them
    const doc = makeParagraphDoc(
      'contractor shall provide construction management services for federal buildings'
    )
    const req = makeReq()
    const result = scanCompliance(doc, [req], 'Technical Approach')
    expect(result.get('REQ-001')).toBe('addressed')
  })

  it('returns partial when 30-59% keywords present', () => {
    // requirement 4+ letter keywords: contractor, shall, provide, construction, management, services, federal, buildings (8 total)
    // Need 30-59% = 3-4 matches out of 8. Use 3 keywords: "construction management services"
    const doc = makeParagraphDoc('construction management services')
    const req = makeReq()
    const result = scanCompliance(doc, [req], 'Technical Approach')
    expect(result.get('REQ-001')).toBe('partial')
  })

  it('returns unaddressed when <30% keywords present', () => {
    // Completely unrelated text
    const doc = makeParagraphDoc('pricing overview and cost estimates')
    const req = makeReq()
    const result = scanCompliance(doc, [req], 'Technical Approach')
    expect(result.get('REQ-001')).toBe('unaddressed')
  })

  it('only checks requirements mapped to given section', () => {
    // A Management topic requirement should NOT appear when scanning Technical Approach
    const doc = makeParagraphDoc(
      'contractor shall provide construction management services for federal buildings'
    )
    const mgmtReq = makeReq({ id: 'REQ-002', proposal_topic: 'Management' })
    const result = scanCompliance(doc, [mgmtReq], 'Technical Approach')
    // Management topic is not mapped to Technical Approach — should be absent from result
    expect(result.has('REQ-002')).toBe(false)
  })

  it('handles empty document gracefully', () => {
    const emptyDoc: JSONContent = { type: 'doc', content: [] }
    const req = makeReq()
    const result = scanCompliance(emptyDoc, [req], 'Technical Approach')
    // Empty text means 0 keyword matches — should be unaddressed
    expect(result.get('REQ-001')).toBe('unaddressed')
  })
})
