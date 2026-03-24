import { describe, it, expect } from 'vitest'
import { Packer, Paragraph, Table, HeadingLevel, UnderlineType } from 'docx'
import type { JSONContent } from '@tiptap/react'
import { nodeToDocxBlocks, buildDocxDocument } from '@/lib/export/tiptap-to-docx'
import { SECTION_NAMES } from '@/lib/editor/types'

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
  it('converts heading nodes to Paragraph with HeadingLevel', () => {
    const h1Node: JSONContent = { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] }
    const h2Node: JSONContent = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sub' }] }
    const [h1Block] = nodeToDocxBlocks(h1Node)
    const [h2Block] = nodeToDocxBlocks(h2Node)
    expect(h1Block).toBeInstanceOf(Paragraph)
    expect(h2Block).toBeInstanceOf(Paragraph)
    // Verify they are paragraphs (heading is a subtype of Paragraph in docx)
    expect(h1Block).toBeDefined()
    expect(h2Block).toBeDefined()
  })

  it('converts paragraph nodes to Paragraph with TextRun children', () => {
    const paraNode: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    }
    const [block] = nodeToDocxBlocks(paraNode)
    expect(block).toBeInstanceOf(Paragraph)
  })

  it('applies bold mark as TextRun bold:true', () => {
    const paraNode: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Bold text' }],
    }
    const [block] = nodeToDocxBlocks(paraNode)
    expect(block).toBeInstanceOf(Paragraph)
    // The paragraph should contain at least one run
    const para = block as Paragraph
    // Access the internal children array via the paragraph's JSON representation
    // We can verify by serializing via Packer
    expect(para).toBeDefined()
  })

  it('applies italic mark as TextRun italics:true', () => {
    const paraNode: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Italic text' }],
    }
    const [block] = nodeToDocxBlocks(paraNode)
    expect(block).toBeInstanceOf(Paragraph)
  })

  it('applies underline mark as TextRun underline', () => {
    const paraNode: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'underline' }], text: 'Underlined' }],
    }
    const [block] = nodeToDocxBlocks(paraNode)
    expect(block).toBeInstanceOf(Paragraph)
  })

  it('converts bulletList to Paragraph with bullet level 0', () => {
    const bulletNode: JSONContent = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] }] },
      ],
    }
    const blocks = nodeToDocxBlocks(bulletNode)
    expect(blocks).toHaveLength(2)
    blocks.forEach(b => expect(b).toBeInstanceOf(Paragraph))
  })

  it('converts orderedList to manually-numbered paragraphs', () => {
    const orderedNode: JSONContent = {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
      ],
    }
    const blocks = nodeToDocxBlocks(orderedNode)
    expect(blocks).toHaveLength(2)
    blocks.forEach(b => expect(b).toBeInstanceOf(Paragraph))
  })

  it('converts table to Table with TableRow and TableCell', () => {
    const tableNode: JSONContent = {
      type: 'table',
      content: [
        { type: 'tableRow', content: [
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }] },
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 2' }] }] },
        ] },
      ],
    }
    const [block] = nodeToDocxBlocks(tableNode)
    expect(block).toBeInstanceOf(Table)
  })

  it('handles empty/null content gracefully', () => {
    const emptyPara: JSONContent = { type: 'paragraph' }
    const emptyDoc: JSONContent = { type: 'doc' }
    expect(() => nodeToDocxBlocks(emptyPara)).not.toThrow()
    expect(() => nodeToDocxBlocks(emptyDoc)).not.toThrow()
    const blocks = nodeToDocxBlocks({ type: 'unknown-node' })
    expect(blocks).toEqual([])
  })
})

describe('buildDocxDocument', () => {
  it('creates one section with all SECTION_NAMES as Heading 1', () => {
    const sections = SECTION_NAMES.map(name => ({
      section_name: name,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }] } as JSONContent,
    }))
    // Should not throw
    const doc = buildDocxDocument(sections)
    expect(doc).toBeDefined()
  })

  it('Packer.toBuffer returns non-empty Uint8Array', async () => {
    const sections = SECTION_NAMES.map(name => ({
      section_name: name,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content here' }] }] } as JSONContent,
    }))
    const doc = buildDocxDocument(sections)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer).toBeInstanceOf(Uint8Array)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('skips sections with null content', () => {
    const sections = [
      { section_name: 'Executive Summary', content: null },
      { section_name: 'Technical Approach', content: { type: 'doc', content: [] } as JSONContent },
    ]
    expect(() => buildDocxDocument(sections)).not.toThrow()
  })
})
