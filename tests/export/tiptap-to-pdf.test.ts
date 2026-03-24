import { describe, it } from 'vitest'
import type { JSONContent } from '@tiptap/react'

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

describe('tiptap-to-pdf converter', () => {
  it.todo('converts heading nodes to Text with heading style')
  it.todo('converts paragraph nodes to Text elements')
  it.todo('applies bold as fontWeight bold')
  it.todo('applies italic as fontStyle italic')
  it.todo('applies underline as textDecoration underline')
  it.todo('converts bulletList items with bullet prefix')
  it.todo('converts orderedList items with numbered prefix')
  it.todo('converts table to View rows')
  it.todo('handles empty/null content gracefully')
})

describe('buildPdfBuffer', () => {
  it.todo('returns non-empty Buffer')
  it.todo('skips sections with null content')
})
