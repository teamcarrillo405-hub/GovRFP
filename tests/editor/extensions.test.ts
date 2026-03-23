import { describe, it, expect } from 'vitest'
import { editorExtensions } from '@/lib/editor/extensions'

describe('editorExtensions', () => {
  it('includes StarterKit', () => {
    const names = editorExtensions.map((e) => e.name)
    expect(names).toContain('starterKit')
  })

  it('includes Underline extension', () => {
    const names = editorExtensions.map((e) => e.name)
    expect(names).toContain('underline')
  })

  it('includes Table extensions', () => {
    const names = editorExtensions.map((e) => e.name)
    expect(names).toContain('table')
    expect(names).toContain('tableRow')
    expect(names).toContain('tableHeader')
    expect(names).toContain('tableCell')
  })

  it('includes ComplianceGapMark', () => {
    const names = editorExtensions.map((e) => e.name)
    expect(names).toContain('complianceGap')
  })

  it('configures heading levels 1, 2, 3', () => {
    // StarterKit is the first entry; its options.heading.levels should be [1,2,3]
    const starterKit = editorExtensions.find((e) => e.name === 'starterKit')
    expect(starterKit).toBeDefined()
    // StarterKit.configure stores options at .options on the configured extension
    const options = (starterKit as unknown as { options: { heading?: { levels?: number[] } } }).options
    expect(options?.heading?.levels).toEqual([1, 2, 3])
  })
})
