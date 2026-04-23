import { describe, it, expect } from 'vitest'
import { markdownToBasicHtml } from '@/lib/editor/markdown-to-html'

describe('markdownToBasicHtml', () => {
  it('wraps a single line in a paragraph', () => {
    expect(markdownToBasicHtml('hello world')).toBe('<p>hello world</p>')
  })

  it('separates paragraphs by blank lines', () => {
    expect(markdownToBasicHtml('one\n\ntwo')).toBe('<p>one</p><p>two</p>')
  })

  it('joins single-newline-separated lines into one paragraph', () => {
    expect(markdownToBasicHtml('first line\nsecond line')).toBe('<p>first line second line</p>')
  })

  it('converts ATX headings (# → h2, ## → h3, ### → h4)', () => {
    expect(markdownToBasicHtml('# Heading')).toBe('<h2>Heading</h2>')
    expect(markdownToBasicHtml('## Sub')).toBe('<h3>Sub</h3>')
    expect(markdownToBasicHtml('### Subsub')).toBe('<h4>Subsub</h4>')
  })

  it('converts bold and italic inline', () => {
    expect(markdownToBasicHtml('a **bold** and *italic* word')).toBe(
      '<p>a <strong>bold</strong> and <em>italic</em> word</p>',
    )
  })

  it('builds an unordered list', () => {
    const md = '- one\n- two\n- three'
    expect(markdownToBasicHtml(md)).toBe('<ul><li>one</li><li>two</li><li>three</li></ul>')
  })

  it('builds an ordered list', () => {
    const md = '1. first\n2. second'
    expect(markdownToBasicHtml(md)).toBe('<ol><li>first</li><li>second</li></ol>')
  })

  it('escapes HTML in source to prevent XSS', () => {
    expect(markdownToBasicHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('handles realistic Claude PP output (heading + body + list)', () => {
    const md = `## Past Performance: Fort Belvoir Operations Building

XYZ Construction completed the design-build of a 35,000 sq ft facility on schedule and 4% under budget.

Key outcomes:
- LEED Silver certification
- Zero safety incidents over 18 months
- CPARS rating: Exceptional`

    const html = markdownToBasicHtml(md)
    expect(html).toContain('<h3>Past Performance: Fort Belvoir Operations Building</h3>')
    expect(html).toContain('<p>XYZ Construction completed')
    expect(html).toContain('<ul><li>LEED Silver certification</li>')
  })
})
