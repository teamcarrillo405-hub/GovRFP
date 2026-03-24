---
phase: 05-export-pipeline
plan: "02"
subsystem: export
tags: [docx, tiptap, converter, api-route, word-export]
dependency_graph:
  requires: [05-01]
  provides: [EXPORT-01]
  affects: [src/lib/export/tiptap-to-docx.ts, src/app/api/proposals/[id]/export/docx/route.ts]
tech_stack:
  added: [docx@9.6.1]
  patterns: [tiptap-jsonContent-walker, docx-document-builder, binary-response-route]
key_files:
  created:
    - src/lib/export/tiptap-to-docx.ts
    - src/app/api/proposals/[id]/export/docx/route.ts
    - tests/export/tiptap-to-docx.test.ts
    - tests/export/export-docx-route.test.ts
  modified: []
decisions:
  - Ordered lists use manual text prefix (1. 2. etc) instead of docx numbering XML — avoids AbstractNumbering/ConcreteNumbering requirement (Pitfall 5)
  - Compliance marks stripped in route handler before converter, not inside converter — keeps converter pure
  - Proposal title loaded from proposals table for sanitized filename in Content-Disposition header
metrics:
  duration: 5 minutes
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 4
---

# Phase 5 Plan 2: Docx Export Converter and API Route Summary

**One-liner:** Tiptap JSONContent-to-docx converter with heading/paragraph/list/table support and authenticated binary download route.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement tiptap-to-docx converter with TDD | ae76d14 | src/lib/export/tiptap-to-docx.ts, tests/export/tiptap-to-docx.test.ts |
| 2 | Implement docx export API route with TDD | 8b6dd57 | src/app/api/proposals/[id]/export/docx/route.ts, tests/export/export-docx-route.test.ts |

## What Was Built

### Task 1 — tiptap-to-docx converter

Created `src/lib/export/tiptap-to-docx.ts` with two exported functions:

**`nodeToDocxBlocks(node: JSONContent): (Paragraph | Table)[]`** — recursive walker handling:
- `doc` — flatMaps all children
- `heading` — Paragraph with HeadingLevel.HEADING_1/2/3 based on attrs.level
- `paragraph` — Paragraph with TextRun children
- `bulletList` — one Paragraph per listItem with `bullet: { level: 0 }`
- `orderedList` — one Paragraph per listItem with manually prefixed text (`1. `, `2. `)
- `table` — Table with TableRow and TableCell wrappers
- `tableHeader`/`tableCell` — TableCell with nested nodeToDocxBlocks children
- `hardBreak` — Paragraph with TextRun `break: 1`
- default — returns `[]` (unknown node types silently skipped)

**`buildDocxDocument(sections)`** — iterates SECTION_NAMES, injects Heading 1 per section, appends nodeToDocxBlocks output. Skips null content sections.

**Internal `textRunsFromNode`** — applies bold, italics, underline marks to TextRun instances.

### Task 2 — docx export API route

Created `src/app/api/proposals/[id]/export/docx/route.ts`:
- `export const runtime = 'nodejs'` — required for Buffer + docx
- Auth gate: `getUser()`, returns 401 if unauthenticated
- Loads proposal title from `proposals` table for filename
- Loads sections from `proposal_sections` ordered by `created_at`
- Returns 404 if no sections found
- Strips compliance marks via `stripComplianceMarks` on each section
- Builds document with `buildDocxDocument`, packs with `Packer.toBuffer`
- Wraps Uint8Array in `Buffer.from()` for Response body
- Returns with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `Content-Disposition: attachment; filename="{sanitized-title}.docx"`

## Test Results

- `tests/export/tiptap-to-docx.test.ts` — 12/12 pass
- `tests/export/export-docx-route.test.ts` — 5/5 pass
- Full suite: 164 tests pass, 0 failures

## Decisions Made

1. **Ordered list manual prefix** — Used `${index + 1}. ` prefix in text instead of docx `numbering` references. Avoids the `AbstractNumbering`/`ConcreteNumbering` XML requirement that causes `Numbering ID not found` errors (Research Pitfall 5).

2. **Compliance stripping in route, not converter** — `stripComplianceMarks` is called in the route handler before passing content to `buildDocxDocument`. This keeps the converter a pure Tiptap-to-docx function with no knowledge of application-level marks.

3. **Proposal title in filename** — Route loads `proposals.title` and sanitizes it to `[a-z0-9-]` for the `Content-Disposition` filename. Falls back to `'proposal'` if title is absent.

## Deviations from Plan

None — plan executed exactly as written. The RESEARCH.md patterns (Pattern 1 and Pattern 2) mapped directly to implementation. No pitfalls triggered during build.

## Known Stubs

None — the converter handles all documented Tiptap node types. Route fully wired to Supabase, compliance stripping, and document generation.

## Self-Check: PASSED
