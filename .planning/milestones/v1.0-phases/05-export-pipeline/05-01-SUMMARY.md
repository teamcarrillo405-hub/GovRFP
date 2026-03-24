---
phase: 05-export-pipeline
plan: 01
subsystem: testing
tags: [docx, react-pdf, next.js, vitest, tiptap, export]

requires:
  - phase: 04-proposal-drafting-editor
    provides: Tiptap JSON editor storage format and section types used in test fixtures

provides:
  - docx@9.6.1 installed and importable in Node.js
  - "@react-pdf/renderer@4.3.2 installed and importable in Node.js"
  - next.config.ts serverExternalPackages configured for @react-pdf/renderer
  - tests/export/tiptap-to-docx.test.ts — 12 todo stubs for DOCX converter
  - tests/export/tiptap-to-pdf.test.ts — 11 todo stubs for PDF converter
  - tests/export/export-docx-route.test.ts — 5 todo stubs for DOCX route
  - tests/export/export-pdf-route.test.ts — 5 todo stubs for PDF route

affects:
  - 05-02-PLAN — DOCX converter implementation uses these stubs as TDD RED targets
  - 05-03-PLAN — PDF converter implementation uses these stubs as TDD RED targets

tech-stack:
  added:
    - docx@9.6.1
    - "@react-pdf/renderer@4.3.2"
  patterns:
    - serverExternalPackages in next.config.ts to prevent react-server condition stripping react-reconciler internals
    - FIXTURE_CONTENT shared Tiptap JSONContent object with all node types (heading, paragraph, bold, italic, underline, bulletList, orderedList, table)

key-files:
  created:
    - tests/export/tiptap-to-docx.test.ts
    - tests/export/tiptap-to-pdf.test.ts
    - tests/export/export-docx-route.test.ts
    - tests/export/export-pdf-route.test.ts
  modified:
    - package.json
    - package-lock.json
    - next.config.ts

key-decisions:
  - "serverExternalPackages: ['@react-pdf/renderer'] in next.config.ts prevents TypeError: ba.Component is not a constructor when react-pdf runs in App Router route handlers — Next.js resolves React via react-server condition by default which strips react-reconciler internals"

patterns-established:
  - "FIXTURE_CONTENT pattern: shared JSONContent fixture with every node type defined at test file top level — reused across both converter test files"

requirements-completed:
  - EXPORT-01
  - EXPORT-02

duration: 5min
completed: 2026-03-24
---

# Phase 5 Plan 01: Export Pipeline Wave 0 — Dependencies and Test Stubs Summary

**docx@9.6.1 and @react-pdf/renderer@4.3.2 installed with next.config.ts server-external fix; 33 Wave 0 test stubs scaffolding all EXPORT-01/02 test cases**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-24T11:54:00Z
- **Completed:** 2026-03-24T11:59:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed `docx@9.6.1` and `@react-pdf/renderer@4.3.2` — both importable from Node.js
- Updated `next.config.ts` with `serverExternalPackages: ['@react-pdf/renderer']` to prevent react-reconciler constructor error in App Router route handlers
- Created 4 test stub files in `tests/export/` with comprehensive `it.todo()` entries covering all test cases from VALIDATION.md
- Full test suite: 147 passing + 33 todos, no regressions

## Task Commits

1. **Task 1: Install packages and update next.config.ts** — `654df7e` (chore)
2. **Task 2: Create Wave 0 test stubs for all 4 test files** — `6820392` (test)

## Files Created/Modified

- `package.json` — docx and @react-pdf/renderer added to dependencies
- `package-lock.json` — lockfile updated with 726 new packages
- `next.config.ts` — serverExternalPackages: ['@react-pdf/renderer'] added
- `tests/export/tiptap-to-docx.test.ts` — 12 todos: tiptap-to-docx converter + buildDocxDocument
- `tests/export/tiptap-to-pdf.test.ts` — 11 todos: tiptap-to-pdf converter + buildPdfBuffer
- `tests/export/export-docx-route.test.ts` — 5 todos: POST /api/proposals/[id]/export/docx
- `tests/export/export-pdf-route.test.ts` — 5 todos: POST /api/proposals/[id]/export/pdf

## Decisions Made

- `serverExternalPackages: ['@react-pdf/renderer']` is required to prevent `TypeError: ba.Component is not a constructor` when `@react-pdf/renderer` runs in Next.js App Router route handlers. Without it, Next.js resolves React via the `react-server` condition, which strips internals that `react-reconciler` needs.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 1 plans (05-02, 05-03) can now implement TDD RED tests against existing stubs, then implement converters and routes
- All node types covered in FIXTURE_CONTENT: heading, paragraph, bold/italic/underline marks, bulletList, orderedList, table
- serverExternalPackages config in place so react-pdf route handlers will work without constructor errors

---
*Phase: 05-export-pipeline*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: tests/export/tiptap-to-docx.test.ts
- FOUND: tests/export/tiptap-to-pdf.test.ts
- FOUND: tests/export/export-docx-route.test.ts
- FOUND: tests/export/export-pdf-route.test.ts
- FOUND: next.config.ts
- FOUND: commit 654df7e
- FOUND: commit 6820392
