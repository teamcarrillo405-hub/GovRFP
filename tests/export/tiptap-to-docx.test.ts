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

describe('tiptap-to-docx converter', () => {
  it.todo('converts heading nodes to Paragraph with HeadingLevel')
  it.todo('converts paragraph nodes to Paragraph with TextRun children')
  it.todo('applies bold mark as TextRun bold:true')
  it.todo('applies italic mark as TextRun italics:true')
  it.todo('applies underline mark as TextRun underline')
  it.todo('converts bulletList to Paragraph with bullet level 0')
  it.todo('converts orderedList to manually-numbered paragraphs')
  it.todo('converts table to Table with TableRow and TableCell')
  it.todo('handles empty/null content gracefully')
})

describe('buildDocxDocument', () => {
  it.todo('creates one section with all SECTION_NAMES as Heading 1')
  it.todo('Packer.toBuffer returns non-empty Uint8Array')
  it.todo('skips sections with null content')
})
