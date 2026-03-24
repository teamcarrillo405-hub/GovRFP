# Phase 5: Export Pipeline - Research

**Researched:** 2026-03-24
**Domain:** Document export — Word (.docx) and PDF from Tiptap JSONContent
**Confidence:** HIGH

---

## Summary

Phase 5 converts stored Tiptap JSONContent (from `proposal_sections` table) into two download formats: Word (.docx) via the `docx` npm package and PDF via `@react-pdf/renderer`. Both libraries are already locked in CLAUDE.md. The core engineering work is writing a recursive Tiptap JSONContent walker that maps each node type (`paragraph`, `heading`, `bulletList`, `orderedList`, `table`, `tableRow`, `tableCell`, `tableHeader`) and each mark type (`bold`, `italic`, `underline`) to the equivalent `docx` or `@react-pdf/renderer` construct.

The critical infrastructure decision is that `@react-pdf/renderer` has well-documented compatibility issues with Next.js App Router prior to v14.1.1, but is resolved via `serverExternalPackages: ['@react-pdf/renderer']` in `next.config.ts` and `export const runtime = 'nodejs'` in the route handler. This project runs Next.js 16.2.1 and React 19.2.4, which satisfies all version requirements for both libraries.

The UI integration point is a new "Export" button area in the editor page (or ProposalEditor component), triggering client-side fetch calls to two new API routes: `POST /api/proposals/[id]/export/docx` and `POST /api/proposals/[id]/export/pdf`. Each route reads all proposal sections from Supabase (auth + RLS enforced), walks the JSONContent, constructs the document, and streams back a binary response with the appropriate `Content-Disposition: attachment` header.

**Primary recommendation:** Build one shared `tiptap-to-content` walker utility that both converters consume. The walker produces an intermediate representation; the docx converter and pdf converter each consume it. This prevents duplicating recursive tree logic.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | User can export complete proposal as Word (.docx) with Heading 1/Heading 2 styles, paragraph formatting, and table structure preserved, compatible with Microsoft Word on Windows | `docx` v9.6.1 — `HeadingLevel.HEADING_1/HEADING_2`, `Paragraph`, `TextRun` (bold/italic/underline), `Table`/`TableRow`/`TableCell`, `Packer.toBuffer()` |
| EXPORT-02 | User can export complete proposal as PDF suitable for internal review with consistent fonts and layout across environments | `@react-pdf/renderer` v4.3.2 — `Document`, `Page`, `View`, `Text`, `StyleSheet`, `Font.register()`, `renderToBuffer()`, with `serverExternalPackages` config in next.config.ts |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

### Locked Decisions
- Word export: `docx` npm package **v9.6.1** (locked — do not use alternatives)
- PDF export: `@react-pdf/renderer` (locked — NOT Puppeteer; Vercel 50MB bundle size limit)
- Editor stores content as Tiptap `JSONContent` type (from `@tiptap/react`)
- Stack: Next.js 16.2.1, React 19.2.4, Tailwind v4, Supabase (`@supabase/ssr`)
- Route protection: `src/proxy.ts` re-exported from `src/middleware.ts`
- `cookies()` and `headers()` must be awaited in Next.js 16
- `params` in page props must be awaited
- Use `getUser()` not `getSession()` server-side
- Zod v4: use `.issues` not `.errors` on `ZodError`
- No emojis in UI — use SVG icons, color, or typography instead

### Claude's Discretion
- How to structure the Tiptap-to-docx converter (shared walker vs. separate walkers)
- Whether export buttons live in EditorToolbar, ProposalEditor, or a separate ExportPanel component
- PDF page size and margin values
- PDF font choice (built-in vs. registered custom font)

### Deferred Ideas (OUT OF SCOPE)
- Direct portal submission (SAM.gov, PIEE)
- Email/CRM integrations
- Agency-specific template libraries

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `docx` | 9.6.1 | Generate Word .docx files from JavaScript objects | Locked in CLAUDE.md; generates OOXML-compliant .docx files; pure JS, no Word installation required; supports heading styles, tables, rich text |
| `@react-pdf/renderer` | 4.3.2 | Generate PDFs from React-like component trees | Locked in CLAUDE.md; avoids Puppeteer (85MB+ bundle, exceeds Vercel 50MB limit); pure JS PDF generation |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tiptap/react` | 2.27.2 (already installed) | Source of `JSONContent` type | Type definitions for the input data structure |
| Built-in `Buffer` | Node.js built-in | Convert `Packer.toBuffer()` result | Required in route handler to build `Response` body |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-pdf/renderer` | Puppeteer/Chromium | NOT viable — 85MB+ binary exceeds Vercel 50MB bundle limit; rejected in CLAUDE.md |
| `@react-pdf/renderer` | `pdf-lib` | Lower-level; no component model; harder to style multi-section documents |
| `docx` npm | `@tiptap-pro/extension-export-docx` | Tiptap Pro extension requires paid private registry access; not available to this project |

**Installation:**
```bash
npm install docx@9.6.1 @react-pdf/renderer@4.3.2
```

**Version verification:** Both versions confirmed current against npm registry on 2026-03-24.
- `docx` 9.6.1 — confirmed current latest
- `@react-pdf/renderer` 4.3.2 — confirmed current latest

---

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/
    export/
      tiptap-to-docx.ts       # JSONContent → docx Document object (pure util)
      tiptap-to-pdf.ts        # JSONContent → @react-pdf/renderer JSX tree (pure util)
  components/
    export/
      ExportButtons.tsx       # 'use client' — two download buttons, handles fetch + blob save
  app/
    api/
      proposals/
        [id]/
          export/
            docx/route.ts     # POST: auth + load sections + Packer.toBuffer → response
            pdf/route.ts      # POST: auth + load sections + renderToBuffer → response
    (dashboard)/
      proposals/
        [id]/
          editor/             # Already exists — add ExportButtons here
tests/
  export/
    tiptap-to-docx.test.ts    # Unit tests: pure converter logic
    tiptap-to-pdf.test.ts     # Unit tests: pure converter logic
    export-route.test.ts      # Route unit tests: auth, subscription gate, headers
```

### Pattern 1: Tiptap JSONContent Node Type Map

**What:** The Tiptap `JSONContent` structure is a recursive tree. Every node has a `type` string and optional `content` array and `marks` array. The converter walks this tree with a `switch` on `type`.

**Tiptap JSONContent node types in this project:**

| Node `type` | `attrs` | Children |
|------------|---------|----------|
| `"doc"` | none | array of block nodes |
| `"paragraph"` | none | array of `text` nodes |
| `"heading"` | `{ level: 1 \| 2 \| 3 }` | array of `text` nodes |
| `"bulletList"` | none | array of `listItem` nodes |
| `"orderedList"` | none | array of `listItem` nodes |
| `"listItem"` | none | array of `paragraph` nodes |
| `"table"` | none | array of `tableRow` nodes |
| `"tableRow"` | none | array of `tableCell` or `tableHeader` nodes |
| `"tableCell"` | none | array of block nodes |
| `"tableHeader"` | none | array of block nodes |
| `"text"` | none | leaf — has `text` string and optional `marks` array |
| `"hardBreak"` | none | leaf — line break |

**Tiptap mark types:**

| Mark `type` | docx TextRun property | @react-pdf fontWeight/style |
|------------|----------------------|----------------------------|
| `"bold"` | `bold: true` | `fontWeight: 'bold'` |
| `"italic"` | `italics: true` | `fontStyle: 'italic'` |
| `"underline"` | `underline: { type: UnderlineType.SINGLE }` | `textDecoration: 'underline'` |

Note: The project uses `ComplianceGapMark` as a custom mark for compliance gap highlighting. This mark MUST be stripped before export (it is visual-only UI state). The existing utility `stripComplianceMarks` in `src/lib/editor/compliance-gap-mark.ts` handles this. Call it on each section's `content` before passing to the converter.

**When to use:** Every time you walk `JSONContent` to produce output.

**Example — docx converter:**
```typescript
// Source: docx npm docs + Tiptap JSONContent structure research
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, UnderlineType, WidthType, BorderStyle,
} from 'docx'
import type { JSONContent } from '@tiptap/react'

function textRunsFromNode(node: JSONContent): TextRun[] {
  if (node.type !== 'text') return []
  const marks = node.marks ?? []
  return [new TextRun({
    text: node.text ?? '',
    bold: marks.some(m => m.type === 'bold'),
    italics: marks.some(m => m.type === 'italic'),
    underline: marks.some(m => m.type === 'underline')
      ? { type: UnderlineType.SINGLE }
      : undefined,
  })]
}

const HEADING_LEVEL_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
}

function nodeToDocxBlocks(node: JSONContent): (Paragraph | Table)[] {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap(nodeToDocxBlocks)
    case 'heading':
      return [new Paragraph({
        heading: HEADING_LEVEL_MAP[node.attrs?.level ?? 1] ?? HeadingLevel.HEADING_1,
        children: (node.content ?? []).flatMap(textRunsFromNode),
      })]
    case 'paragraph':
      return [new Paragraph({
        children: (node.content ?? []).flatMap(textRunsFromNode),
      })]
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? []).flatMap(listItem =>
        (listItem.content ?? []).flatMap(para =>
          para.type === 'paragraph' ? [new Paragraph({
            bullet: node.type === 'bulletList' ? { level: 0 } : undefined,
            numbering: node.type === 'orderedList' ? { reference: 'default-numbering', level: 0 } : undefined,
            children: (para.content ?? []).flatMap(textRunsFromNode),
          })] : []
        )
      )
    case 'table':
      return [new Table({
        rows: (node.content ?? []).map(row =>
          new TableRow({
            children: (row.content ?? []).map(cell =>
              new TableCell({
                children: (cell.content ?? []).flatMap(nodeToDocxBlocks) as Paragraph[],
              })
            ),
          })
        ),
        width: { size: 100, type: WidthType.PERCENTAGE },
      })]
    default:
      return []
  }
}
```

### Pattern 2: docx Route Handler

**What:** API route that reads all proposal sections, calls the converter, returns a binary file response.

**Example:**
```typescript
// Source: Next.js App Router route handler docs + docx Packer docs
// src/app/api/proposals/[id]/export/docx/route.ts
import { Packer, Document } from 'docx'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'  // required — docx uses Node.js Buffer

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // Next.js 16: await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data: sections } = await supabase
    .from('proposal_sections')
    .select('section_name, content')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  if (!sections?.length) return new Response('No sections found', { status: 404 })

  const doc = buildDocxDocument(sections)  // your converter
  const buffer = await Packer.toBuffer(doc)

  return new Response(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="proposal.docx"',
    },
  })
}
```

### Pattern 3: @react-pdf/renderer Route Handler

**What:** API route using `renderToBuffer`. Requires `serverExternalPackages` in `next.config.ts` and `export const runtime = 'nodejs'` in the route file.

**next.config.ts change (REQUIRED):**
```typescript
// Source: Next.js docs + react-pdf/renderer GitHub issues #3074, #2460
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
}

export default nextConfig
```

**Example route:**
```typescript
// src/app/api/proposals/[id]/export/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'  // CRITICAL — prevents edge runtime + react-reconciler conflict

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data: sections } = await supabase
    .from('proposal_sections')
    .select('section_name, content')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  if (!sections?.length) return new Response('No sections found', { status: 404 })

  const pdfDoc = buildPdfDocument(sections)  // your @react-pdf/renderer component tree
  const buffer = await renderToBuffer(pdfDoc)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="proposal.pdf"',
    },
  })
}
```

### Pattern 4: @react-pdf/renderer Component Structure

**What:** PDF document structure using core components.

```typescript
// Source: react-pdf.org documentation
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 72, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.4 },
  heading1: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  heading2: { fontSize: 13, fontWeight: 'bold', marginBottom: 4, marginTop: 10 },
  paragraph: { marginBottom: 6 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #ccc' },
  tableCell: { flex: 1, padding: 4, borderRight: '1px solid #ccc' },
})

// @react-pdf/renderer does not support JSX in Node.js without Babel transform.
// Use React.createElement directly in route handlers, or use a tsx file with
// the appropriate tsconfig settings.
```

**IMPORTANT:** `@react-pdf/renderer` uses its own subset of CSS — not all CSS properties are valid. Key supported properties: `flexDirection`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontStyle`, `textDecoration`, `color`, `border`, `borderBottom`, `borderRight`, `lineHeight`. Unsupported: `display: block`, most pseudo-selectors, grid.

### Pattern 5: Client-Side Export Button

**What:** Client component that calls the export API, receives binary blob, triggers browser download using `URL.createObjectURL`.

```typescript
// src/components/export/ExportButtons.tsx
'use client'
import { useState } from 'react'

interface Props {
  proposalId: string
}

export default function ExportButtons({ proposalId }: Props) {
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  async function downloadFile(format: 'docx' | 'pdf') {
    const setter = format === 'docx' ? setDownloadingDocx : setDownloadingPdf
    setter(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/export/${format}`, { method: 'POST' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposal.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setter(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={downloadingDocx}
        onClick={() => downloadFile('docx')}
        className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {downloadingDocx ? 'Exporting...' : 'Export Word'}
      </button>
      <button
        type="button"
        disabled={downloadingPdf}
        onClick={() => downloadFile('pdf')}
        className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {downloadingPdf ? 'Exporting...' : 'Export PDF'}
      </button>
    </div>
  )
}
```

**Integration point:** Add `<ExportButtons proposalId={proposalId} />` to the editor page layout — place it in the header/toolbar area alongside the existing navigation. The editor page (`src/app/(dashboard)/proposals/[id]/editor/page.tsx`) is a Server Component; `ExportButtons` is a Client Component, so it can be imported there.

### Anti-Patterns to Avoid

- **Using `@react-pdf/renderer` without `serverExternalPackages`:** Causes `TypeError: ba.Component is not a constructor` in Next.js App Router. Always add to `next.config.ts`.
- **Using edge runtime for export routes:** Both `docx` and `@react-pdf/renderer` require Node.js APIs (`Buffer`, `stream`). Always set `export const runtime = 'nodejs'` in both route files.
- **Forgetting to strip `ComplianceGapMark`:** The compliance gap mark is a UI-only ProseMirror mark stored in the JSONContent. If not stripped, its `type: 'complianceGap'` will hit the `default` case in the walker and silently drop text runs. Always call `stripComplianceMarks(content)` before conversion.
- **Concatenating all sections as a flat list without section headings:** Each section is stored separately by name. The docx/pdf document should inject a `Heading 1` for each section name before its content — otherwise the exported document has no top-level structure visible to the reader.
- **`Packer.toBuffer()` type issue:** Returns `Promise<Uint8Array>` (not a Node `Buffer`). Wrap with `Buffer.from(result)` before passing to `new Response()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Word .docx generation | Custom OOXML/ZIP writer | `docx` v9.6.1 `Document` + `Packer.toBuffer()` | OOXML format is ~500 pages of spec; table cell merging, heading styles, numbering XML are non-trivial |
| PDF rendering | Canvas drawing API or HTML-to-image hacks | `@react-pdf/renderer` | PDF layout engine (line breaking, pagination, font metrics) is ~10k LOC; PDFKit alone does not handle component-style layout |
| Client file download | Form POST or `window.location` | `URL.createObjectURL` + dynamic `<a>` click | Form POST can't stream binary responses to download; `window.location` causes navigation away |
| JSX in Node.js for PDF | Import React + Babel transform for route handlers | Create the element tree using `React.createElement` or keep the PDF template in a `.tsx` file handled by Next.js TSX pipeline | Route handlers are TS, not TSX — JSX syntax won't compile without configuration |

**Key insight:** Both docx and PDF are binary formats with complex internal structure. The npm libraries encapsulate thousands of lines of format-specific logic. Even simple tables in OOXML require correct `w:tbl`, `w:tr`, `w:tc` XML nesting — any deviation produces a file Word refuses to open.

---

## Common Pitfalls

### Pitfall 1: @react-pdf/renderer Module Resolution Conflict in App Router

**What goes wrong:** `TypeError: ba.Component is not a constructor` or `PDFDocument is not a constructor` when calling `renderToBuffer` from an App Router route handler.

**Why it happens:** Next.js App Router resolves React via the `react-server` export condition, which gives a stripped-down version of React missing `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. `react-pdf` bundles `react-reconciler` which requires those internals.

**How to avoid:** Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts`. This tells Next.js to NOT bundle the library server-side, letting Node.js resolve it via the default condition.

**Warning signs:** The error appears at runtime (not build time). Build succeeds but PDF export returns HTTP 500.

### Pitfall 2: Missing `export const runtime = 'nodejs'` in Route Files

**What goes wrong:** Export routes are deployed to Vercel Edge Runtime, which lacks Node.js `Buffer`, `stream`, and `canvas`. Both `docx` and `@react-pdf/renderer` require these.

**Why it happens:** Next.js defaults route handlers to the Edge Runtime on Vercel when using App Router, unless explicitly overridden.

**How to avoid:** Add `export const runtime = 'nodejs'` at the top of both route files.

**Warning signs:** Works locally (Node.js dev server always uses Node runtime), fails only on Vercel deployment.

### Pitfall 3: ComplianceGapMark Leaking Into Export

**What goes wrong:** Text nodes inside compliance-marked regions are dropped silently from the exported document because the custom mark type `'complianceGap'` is not handled by the converter's `switch` statement.

**Why it happens:** The compliance mark wraps text nodes and appears in the stored `JSONContent`. The walker hits the default case and skips those marks.

**How to avoid:** Call `stripComplianceMarks(content)` on each section's content before passing to any converter. This function already exists at `src/lib/editor/compliance-gap-mark.ts`.

**Warning signs:** Exported document is shorter than the editor content. Some formatted text is present but some paragraphs appear truncated.

### Pitfall 4: Empty Section Exports

**What goes wrong:** Sections that were never drafted show `null` content in `proposal_sections` and cause the converter to throw or produce empty output.

**Why it happens:** Not all five sections are guaranteed to have content — a user might export before drafting all sections.

**How to avoid:** Filter out sections where `content` is `null` before conversion, or substitute an empty `doc` node. Add a guard in the route handler.

**Warning signs:** Export API throws `Cannot read properties of null` during JSONContent walk.

### Pitfall 5: docx numbering for ordered lists

**What goes wrong:** Ordered list items rendered with `numbering` reference throw `docx` validation errors if the `AbstractNumbering` / `ConcreteNumbering` objects are not declared in the `Document`'s `numbering` array.

**Why it happens:** `docx` requires numbered lists to reference a predefined numbering configuration attached to the `Document`, not defined inline.

**How to avoid:** Add a `numbering` configuration to the `Document` constructor and reference its `reference` ID in list items. Alternatively, implement ordered lists as manually numbered paragraphs (`new Paragraph({ text: '1. Item text' })`) — simpler and avoids the numbering setup entirely for MVP.

**Warning signs:** `Error: Numbering ID not found` at `Packer.toBuffer()` call.

---

## Code Examples

### Complete docx Document Builder

```typescript
// Source: docx npm v9 docs
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         HeadingLevel, UnderlineType, WidthType } from 'docx'
import type { JSONContent } from '@tiptap/react'
import { SECTION_NAMES } from '@/lib/editor/types'

export function buildDocxDocument(
  sections: Array<{ section_name: string; content: JSONContent | null }>
): Document {
  const children: (Paragraph | Table)[] = []

  for (const name of SECTION_NAMES) {
    const section = sections.find(s => s.section_name === name)
    // Section title as Heading 1
    children.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_1 }))
    if (section?.content) {
      children.push(...nodeToDocxBlocks(section.content))
    }
  }

  return new Document({ sections: [{ children }] })
}
```

### renderToBuffer with section content

```typescript
// Source: @react-pdf/renderer docs
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'  // React.createElement needed in .ts files

const styles = StyleSheet.create({
  page: { padding: 72, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5 },
  h1: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 13, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  paragraph: { marginBottom: 6 },
})

// Build PDF element tree from sections array
export async function buildPdfBuffer(sections: Array<{ section_name: string; content: JSONContent | null }>) {
  const pageChildren = sections.flatMap(s => tiptapToPdfElements(s.section_name, s.content))
  const doc = React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page }, ...pageChildren)
  )
  return renderToBuffer(doc)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer/Chromium for PDF | `@react-pdf/renderer` | Pre-Vercel serverless era | Bundle size dropped from 100MB+ to ~15MB |
| `serverComponentsExternalPackages` (experimental) | `serverExternalPackages` (stable) | Next.js 14.1 | No more `experimental` wrapper; same key, moved to top-level config |
| react-pdf v3 | react-pdf v4 (React 19 support added in v4.1.0) | 2024 | v4.3.2 supports React 19.2.4 used in this project |

**Deprecated/outdated:**
- `experimental.serverComponentsExternalPackages`: Moved to top-level `serverExternalPackages` in Next.js 14.1+. Use the top-level key.
- `Packer.toBase64String()` for route responses: Use `Packer.toBuffer()` + `Buffer.from()` for binary correctness.

---

## Open Questions

1. **PDF font rendering on Windows**
   - What we know: `@react-pdf/renderer` embeds its own PDF font system. Default fonts (`Helvetica`, `Courier`, `Times-Roman`) are built-in. Custom TTF/OTF fonts can be registered via `Font.register()`.
   - What's unclear: Whether the target audience (contractors opening on Windows) will encounter font substitution issues with the built-in fonts.
   - Recommendation: Use `Helvetica` (built-in) for the MVP PDF. The requirement specifies "fonts and layout consistent across environments" — built-in fonts satisfy this since they are embedded in the PDF file.

2. **Proposal title in export filename**
   - What we know: The route handler has access to the proposal `id` from params. The `proposals` table has a `title` column.
   - What's unclear: Whether the filename should be `proposal.docx` or `{proposal-title}.docx`.
   - Recommendation: Load the proposal title in the route handler and use it in `Content-Disposition: attachment; filename="${slugifiedTitle}.docx"`. Sanitize to ASCII alphanumeric + hyphens.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Both export routes (`runtime: 'nodejs'`) | Yes | 20.x (Next.js 16 requirement) | — |
| `docx` npm package | EXPORT-01 | Not yet installed | 9.6.1 (registry confirmed) | — |
| `@react-pdf/renderer` npm | EXPORT-02 | Not yet installed | 4.3.2 (registry confirmed) | — |
| `@tiptap/react` (JSONContent type) | Both converters | Yes (2.27.2 installed) | 2.27.2 | — |

**Missing dependencies with no fallback:**
- `docx@9.6.1` — must be installed before Wave 1
- `@react-pdf/renderer@4.3.2` — must be installed before Wave 1

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/export/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | `tiptap-to-docx` converter handles all node types (heading, paragraph, list, table) and produces a valid `Document` | unit | `npx vitest run tests/export/tiptap-to-docx.test.ts` | Wave 0 |
| EXPORT-01 | `Packer.toBuffer()` on the built document returns a non-empty Buffer | unit | `npx vitest run tests/export/tiptap-to-docx.test.ts` | Wave 0 |
| EXPORT-01 | Export docx route returns 401 for unauthenticated request | unit (route) | `npx vitest run tests/export/export-route.test.ts` | Wave 0 |
| EXPORT-01 | Export docx route returns correct Content-Type and Content-Disposition headers | unit (route) | `npx vitest run tests/export/export-route.test.ts` | Wave 0 |
| EXPORT-02 | `tiptap-to-pdf` converter handles all node types and passes to `renderToBuffer` without throwing | unit | `npx vitest run tests/export/tiptap-to-pdf.test.ts` | Wave 0 |
| EXPORT-02 | Export PDF route returns correct Content-Type and Content-Disposition headers | unit (route) | `npx vitest run tests/export/export-route.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/export/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/export/tiptap-to-docx.test.ts` — covers EXPORT-01 converter unit tests
- [ ] `tests/export/tiptap-to-pdf.test.ts` — covers EXPORT-02 converter unit tests
- [ ] `tests/export/export-route.test.ts` — covers auth, headers, Content-Type for both routes
- [ ] Package install: `npm install docx@9.6.1 @react-pdf/renderer@4.3.2`

---

## Sources

### Primary (HIGH confidence)

- docx npm registry — version 9.6.1 confirmed current on 2026-03-24
- @react-pdf/renderer npm registry — version 4.3.2 confirmed current on 2026-03-24
- `https://github.com/dolanmiu/docx/blob/master/docs/usage/packers.md` — Packer methods
- `https://github.com/dolanmiu/docx/blob/master/docs/usage/paragraph.md` — HeadingLevel, TextRun API
- `https://github.com/dolanmiu/docx` — Table/TableRow/TableCell constructor pattern
- Project source files: `src/lib/editor/types.ts`, `src/lib/editor/extensions.ts`, `src/lib/editor/compliance-gap-mark.ts` — Tiptap extension list, JSONContent types, ComplianceGapMark

### Secondary (MEDIUM confidence)

- `https://github.com/diegomura/react-pdf/issues/3074` — Next.js 15 `serverExternalPackages` fix for PDFDocument constructor error, React 19 compatibility
- `https://github.com/diegomura/react-pdf/issues/2460` — App Router compatibility history and `serverExternalPackages` workaround
- `https://react-pdf.org/compatibility` — React version compatibility matrix (React 19 supported since v4.1.0)
- `https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages` — Next.js `serverExternalPackages` config key (stable, not experimental in Next.js 14.1+)

### Tertiary (LOW confidence)

- WebSearch: Tiptap JSONContent node type strings — cross-verified against project test files which already use `type: 'paragraph'`, `type: 'heading'`, `type: 'text'` patterns

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions confirmed on npm registry 2026-03-24; both libraries locked in CLAUDE.md
- Architecture: HIGH — Tiptap JSONContent node types verified against existing project test fixtures in `tests/editor/compliance-scanner.test.ts`; route handler patterns verified against Next.js docs and docx packer docs
- @react-pdf/renderer compatibility: MEDIUM-HIGH — `serverExternalPackages` fix confirmed across multiple GitHub issues; behavior on Next.js 16.2.1 + React 19.2.4 specifically not tested but all known requirements (React 19 support via v4.1.0+, `serverExternalPackages` stable key) are satisfied
- Pitfalls: HIGH — three of five pitfalls derived directly from project source code inspection and library GitHub issues; two from existing project patterns

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (90 days — docx and react-pdf are stable libraries; Next.js 16 is current)
