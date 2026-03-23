import { Mark } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'

export const ComplianceGapMark = Mark.create({
  name: 'complianceGap',

  addAttributes() {
    return {
      requirementId: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-compliance-gap]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', {
      ...HTMLAttributes,
      'data-compliance-gap': HTMLAttributes.requirementId ?? '',
      class: 'compliance-gap',
    }, 0]
  },
})

/**
 * Remove all complianceGap marks from Tiptap JSON.
 * Used before saving to Supabase and before Phase 5 export.
 */
export function stripComplianceMarks(json: JSONContent): JSONContent {
  const result = { ...json }
  if (result.marks) {
    result.marks = result.marks.filter(m => m.type !== 'complianceGap')
    if (result.marks.length === 0) delete result.marks
  }
  if (result.content) {
    result.content = result.content.map(stripComplianceMarks)
  }
  return result
}
