import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { JSONContent } from '@tiptap/react'
import { SECTION_NAMES } from '@/lib/editor/types'

const styles = StyleSheet.create({
  page: { padding: 72, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5 },
  h1: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 13, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 11, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  paragraph: { marginBottom: 6 },
  listItem: { marginBottom: 2, paddingLeft: 12 },
  tableRow: { flexDirection: 'row' as const, borderBottom: '1px solid #cccccc' },
  tableCell: { flex: 1, padding: 4, borderRight: '1px solid #cccccc' },
  tableHeaderCell: { flex: 1, padding: 4, borderRight: '1px solid #cccccc', fontWeight: 'bold' as const },
})

function textStyle(marks: Array<{ type: string }> | undefined): Record<string, unknown> {
  if (!marks || marks.length === 0) return {}
  const style: Record<string, unknown> = {}
  for (const mark of marks) {
    if (mark.type === 'bold') style.fontWeight = 'bold'
    if (mark.type === 'italic') style.fontStyle = 'italic'
    if (mark.type === 'underline') style.textDecoration = 'underline'
  }
  return style
}

function nodeToElements(node: JSONContent): React.ReactElement[] {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap(nodeToElements)

    case 'heading': {
      const level = node.attrs?.level ?? 1
      const headingStyle = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      const children = (node.content ?? []).map((child, i) =>
        React.createElement(Text, { key: i, style: textStyle(child.marks) }, child.text ?? '')
      )
      return [React.createElement(Text, { style: headingStyle }, ...children)]
    }

    case 'paragraph': {
      const children = (node.content ?? []).map((child, i) => {
        if (child.type === 'hardBreak') {
          return React.createElement(Text, { key: i }, '\n')
        }
        return React.createElement(Text, { key: i, style: textStyle(child.marks) }, child.text ?? '')
      })
      return [React.createElement(Text, { style: styles.paragraph }, ...children)]
    }

    case 'bulletList': {
      return (node.content ?? []).map((listItem, itemIdx) => {
        const paragraphs = (listItem.content ?? []).flatMap((para, paraIdx) => {
          const children = (para.content ?? []).map((child, childIdx) =>
            React.createElement(Text, { key: childIdx, style: textStyle(child.marks) }, child.text ?? '')
          )
          return [React.createElement(Text, { key: `para-${paraIdx}` }, '\u2022 ', ...children)]
        })
        return React.createElement(
          Text,
          { key: itemIdx, style: styles.listItem },
          ...paragraphs
        )
      })
    }

    case 'orderedList': {
      return (node.content ?? []).map((listItem, itemIdx) => {
        const prefix = `${itemIdx + 1}. `
        const paragraphs = (listItem.content ?? []).flatMap((para, paraIdx) => {
          const children = (para.content ?? []).map((child, childIdx) =>
            React.createElement(Text, { key: childIdx, style: textStyle(child.marks) }, child.text ?? '')
          )
          return [React.createElement(Text, { key: `para-${paraIdx}` }, prefix, ...children)]
        })
        return React.createElement(
          Text,
          { key: itemIdx, style: styles.listItem },
          ...paragraphs
        )
      })
    }

    case 'table': {
      const rows = (node.content ?? []).map((row, rowIdx) => {
        const cells = (row.content ?? []).map((cell, cellIdx) => {
          const cellStyle = cell.type === 'tableHeader' ? styles.tableHeaderCell : styles.tableCell
          const cellContent = (cell.content ?? []).flatMap(nodeToElements)
          return React.createElement(View, { key: cellIdx, style: cellStyle }, ...cellContent)
        })
        return React.createElement(View, { key: rowIdx, style: styles.tableRow }, ...cells)
      })
      return [React.createElement(View, null, ...rows)]
    }

    case 'text': {
      return [React.createElement(Text, { style: textStyle(node.marks) }, node.text ?? '')]
    }

    case 'hardBreak': {
      return [React.createElement(Text, null, '\n')]
    }

    default:
      return []
  }
}

/**
 * Convert a single Tiptap section to a flat list of @react-pdf/renderer elements.
 * Prepends the section name as an H1 heading.
 */
export function tiptapToPdfElements(
  sectionName: string,
  content: JSONContent | null
): React.ReactElement[] {
  const titleElement = React.createElement(Text, { style: styles.h1 }, sectionName)

  if (!content) {
    return [titleElement]
  }

  const contentElements = nodeToElements(content)
  return [titleElement, ...contentElements]
}

/**
 * Build a complete PDF buffer from an array of proposal sections.
 * Sections are ordered per SECTION_NAMES; sections not in SECTION_NAMES are included last.
 */
export async function buildPdfBuffer(
  sections: Array<{ section_name: string; content: JSONContent | null }>
): Promise<Buffer> {
  const allElements: React.ReactElement[] = []

  for (const name of SECTION_NAMES) {
    const section = sections.find(s => s.section_name === name)
    if (!section) continue
    const elements = tiptapToPdfElements(section.section_name, section.content)
    allElements.push(...elements)
  }

  // Also include sections not in SECTION_NAMES order
  for (const section of sections) {
    if (!SECTION_NAMES.includes(section.section_name as typeof SECTION_NAMES[number])) {
      const elements = tiptapToPdfElements(section.section_name, section.content)
      allElements.push(...elements)
    }
  }

  const doc = React.createElement(
    Document,
    null,
    React.createElement(Page, { size: 'LETTER', style: styles.page }, ...allElements)
  )

  return renderToBuffer(doc) as Promise<Buffer>
}
