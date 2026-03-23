import { describe, it, expect } from 'vitest'
import { ComplianceGapMark, stripComplianceMarks } from '@/lib/editor/compliance-gap-mark'
import type { JSONContent } from '@tiptap/react'

describe('ComplianceGapMark', () => {
  it('has name complianceGap', () => {
    expect(ComplianceGapMark.name).toBe('complianceGap')
  })

  it('has requirementId attribute', () => {
    const attrs = ComplianceGapMark.config.addAttributes!()
    expect(attrs).toHaveProperty('requirementId')
    expect((attrs as Record<string, { default: unknown }>).requirementId.default).toBeNull()
  })

  it('renders with data-compliance-gap attribute', () => {
    const parseHTML = ComplianceGapMark.config.parseHTML!()
    expect(Array.isArray(parseHTML)).toBe(true)
    expect(parseHTML[0]).toHaveProperty('tag', 'span[data-compliance-gap]')
  })
})

describe('stripComplianceMarks', () => {
  it('removes complianceGap marks from Tiptap JSON', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [
                { type: 'complianceGap', attrs: { requirementId: 'REQ-001' } },
                { type: 'bold' },
              ],
            },
          ],
        },
      ],
    }

    const result = stripComplianceMarks(input)
    const textNode = result.content![0].content![0]
    expect(textNode.marks).toEqual([{ type: 'bold' }])
  })

  it('preserves other marks (bold, italic)', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'world',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    }

    const result = stripComplianceMarks(input)
    const textNode = result.content![0].content![0]
    expect(textNode.marks).toEqual([{ type: 'bold' }, { type: 'italic' }])
  })

  it('handles document with no marks', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'plain' }],
        },
      ],
    }

    const result = stripComplianceMarks(input)
    // Output should equal input (no marks to strip)
    expect(result.content![0].content![0].marks).toBeUndefined()
    expect(result.content![0].content![0].text).toBe('plain')
  })
})
