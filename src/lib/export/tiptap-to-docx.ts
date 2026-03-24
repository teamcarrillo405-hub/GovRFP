import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  UnderlineType,
  WidthType,
} from 'docx'
import type { JSONContent } from '@tiptap/react'
import { SECTION_NAMES } from '@/lib/editor/types'

const HEADING_LEVEL_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
}

function textRunsFromNode(node: JSONContent): TextRun[] {
  if (node.type !== 'text') return []
  const marks = node.marks ?? []
  return [
    new TextRun({
      text: node.text ?? '',
      bold: marks.some(m => m.type === 'bold'),
      italics: marks.some(m => m.type === 'italic'),
      underline: marks.some(m => m.type === 'underline')
        ? { type: UnderlineType.SINGLE }
        : undefined,
    }),
  ]
}

export function nodeToDocxBlocks(node: JSONContent): (Paragraph | Table)[] {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap(nodeToDocxBlocks)

    case 'heading':
      return [
        new Paragraph({
          heading:
            HEADING_LEVEL_MAP[node.attrs?.level ?? 1] ?? HeadingLevel.HEADING_1,
          children: (node.content ?? []).flatMap(textRunsFromNode),
        }),
      ]

    case 'paragraph':
      return [
        new Paragraph({
          children: (node.content ?? []).flatMap(textRunsFromNode),
        }),
      ]

    case 'bulletList':
      return (node.content ?? []).flatMap(listItem =>
        (listItem.content ?? []).flatMap(para => {
          if (para.type !== 'paragraph') return []
          return [
            new Paragraph({
              bullet: { level: 0 },
              children: (para.content ?? []).flatMap(textRunsFromNode),
            }),
          ]
        })
      )

    case 'orderedList':
      return (node.content ?? []).flatMap((listItem, index) =>
        (listItem.content ?? []).flatMap(para => {
          if (para.type !== 'paragraph') return []
          const prefix = `${index + 1}. `
          const textChildren = (para.content ?? []).flatMap(textRunsFromNode)
          // Prepend index prefix to first text run, or add standalone run
          if (textChildren.length > 0) {
            return [
              new Paragraph({
                children: [
                  new TextRun({ text: prefix }),
                  ...textChildren,
                ],
              }),
            ]
          }
          return [
            new Paragraph({
              children: [new TextRun({ text: prefix })],
            }),
          ]
        })
      )

    case 'table':
      return [
        new Table({
          rows: (node.content ?? []).map(
            row =>
              new TableRow({
                children: (row.content ?? []).map(
                  cell =>
                    new TableCell({
                      children: (cell.content ?? []).flatMap(
                        nodeToDocxBlocks
                      ) as Paragraph[],
                    })
                ),
              })
          ),
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ]

    case 'hardBreak':
      return [new Paragraph({ children: [new TextRun({ break: 1 })] })]

    default:
      return []
  }
}

export function buildDocxDocument(
  sections: Array<{ section_name: string; content: JSONContent | null }>
): Document {
  const children: (Paragraph | Table)[] = []

  for (const name of SECTION_NAMES) {
    const section = sections.find(s => s.section_name === name)
    // Section title as Heading 1
    children.push(
      new Paragraph({
        text: name,
        heading: HeadingLevel.HEADING_1,
      })
    )
    if (section?.content) {
      children.push(...nodeToDocxBlocks(section.content))
    }
  }

  return new Document({ sections: [{ children }] })
}
