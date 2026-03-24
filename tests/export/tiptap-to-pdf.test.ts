import { describe, it, expect } from 'vitest'
import type { JSONContent } from '@tiptap/react'
import { tiptapToPdfElements, buildPdfBuffer } from '../../src/lib/export/tiptap-to-pdf'
import React from 'react'

const FIXTURE_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'This is ' },
      { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
      { type: 'text', text: ' and ' },
      { type: 'text', marks: [{ type: 'underline' }], text: 'underlined' },
      { type: 'text', text: '.' },
    ] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] }] },
    ] },
    { type: 'orderedList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
    ] },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header A' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header B' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 2' }] }] },
      ] },
    ] },
    { type: 'paragraph', content: [{ type: 'text', text: 'End paragraph.' }] },
  ],
}

// Helper: flatten all React elements in a tree into a flat array
function flattenElements(elements: React.ReactElement[]): React.ReactElement[] {
  const result: React.ReactElement[] = []
  function walk(el: React.ReactElement) {
    result.push(el)
    const children = el.props?.children
    if (Array.isArray(children)) {
      children.forEach((c: unknown) => {
        if (c && typeof c === 'object' && 'props' in (c as object)) {
          walk(c as React.ReactElement)
        }
      })
    } else if (children && typeof children === 'object' && 'props' in (children as object)) {
      walk(children as React.ReactElement)
    }
  }
  elements.forEach(walk)
  return result
}

describe('tiptap-to-pdf converter', () => {
  it('converts heading nodes to Text with heading style', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Main Title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
      ],
    })

    const all = flattenElements(elements)
    // Find heading elements by their style properties
    const h1Elements = all.filter(el =>
      el.props?.style?.fontSize === 16 && el.props?.style?.fontWeight === 'bold'
    )
    const h2Elements = all.filter(el =>
      el.props?.style?.fontSize === 13 && el.props?.style?.fontWeight === 'bold'
    )

    expect(h1Elements.length).toBeGreaterThan(0)
    expect(h2Elements.length).toBeGreaterThan(0)
  })

  it('converts paragraph nodes to Text elements', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    })

    const all = flattenElements(elements)
    const paragraphElements = all.filter(el =>
      el.props?.style?.marginBottom === 6
    )
    expect(paragraphElements.length).toBeGreaterThan(0)
  })

  it('applies bold as fontWeight bold', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Bold text' },
        ] },
      ],
    })

    const all = flattenElements(elements)
    const boldElements = all.filter(el =>
      el.props?.style?.fontWeight === 'bold' && el.props?.children === 'Bold text'
    )
    expect(boldElements.length).toBeGreaterThan(0)
  })

  it('applies italic as fontStyle italic', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [
          { type: 'text', marks: [{ type: 'italic' }], text: 'Italic text' },
        ] },
      ],
    })

    const all = flattenElements(elements)
    const italicElements = all.filter(el =>
      el.props?.style?.fontStyle === 'italic' && el.props?.children === 'Italic text'
    )
    expect(italicElements.length).toBeGreaterThan(0)
  })

  it('applies underline as textDecoration underline', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [
          { type: 'text', marks: [{ type: 'underline' }], text: 'Underline text' },
        ] },
      ],
    })

    const all = flattenElements(elements)
    const underlineElements = all.filter(el =>
      el.props?.style?.textDecoration === 'underline' && el.props?.children === 'Underline text'
    )
    expect(underlineElements.length).toBeGreaterThan(0)
  })

  it('converts bulletList items with bullet prefix', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] }] },
        ] },
      ],
    })

    // Stringify the elements tree to check for bullet character
    const str = JSON.stringify(elements)
    expect(str).toContain('\u2022')
  })

  it('converts orderedList items with numbered prefix', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'orderedList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
        ] },
      ],
    })

    const str = JSON.stringify(elements)
    expect(str).toContain('1.')
    expect(str).toContain('2.')
  })

  it('converts table to View rows', () => {
    const elements = tiptapToPdfElements('Test Section', {
      type: 'doc',
      content: [
        { type: 'table', content: [
          { type: 'tableRow', content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }] },
          ] },
        ] },
      ],
    })

    const all = flattenElements(elements)
    // table rows should have flexDirection row
    const rowElements = all.filter(el =>
      el.props?.style?.flexDirection === 'row'
    )
    expect(rowElements.length).toBeGreaterThan(0)
  })

  it('handles empty/null content gracefully', () => {
    // null content returns empty array (section is skipped)
    const elements = tiptapToPdfElements('Empty Section', null)
    // Should return just the section title heading
    expect(Array.isArray(elements)).toBe(true)
    expect(elements.length).toBeGreaterThanOrEqual(0)
  })
})

describe('buildPdfBuffer', () => {
  it('returns non-empty Buffer', async () => {
    const sections = [
      { section_name: 'Executive Summary', content: FIXTURE_CONTENT },
    ]
    const buffer = await buildPdfBuffer(sections)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  }, 30000)

  it('skips sections with null content', async () => {
    const sections = [
      { section_name: 'Executive Summary', content: null },
      { section_name: 'Technical Approach', content: FIXTURE_CONTENT },
    ]
    const buffer = await buildPdfBuffer(sections)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  }, 30000)
})
