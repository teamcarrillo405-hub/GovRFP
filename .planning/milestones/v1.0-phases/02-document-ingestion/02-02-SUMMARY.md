---
phase: 02-document-ingestion
plan: "02"
subsystem: document-parsing
tags: [pdf, docx, textract, ocr, rfp-structure, unpdf, mammoth, aws]
dependency_graph:
  requires: ["02-01"]
  provides: ["02-03", "02-04"]
  affects: []
tech_stack:
  added: ["unpdf@1.4.0", "@aws-sdk/client-textract", "mammoth"]
  patterns: ["pure-function libraries", "regex heuristics", "isomorphic Buffer/Uint8Array handling"]
key_files:
  created:
    - src/lib/documents/parse-pdf.ts
    - src/lib/documents/parse-docx.ts
    - src/lib/documents/textract.ts
    - src/lib/documents/rfp-structure.ts
  modified:
    - tests/documents/parse-pdf.test.ts
    - tests/documents/parse-docx.test.ts
    - tests/documents/rfp-structure.test.ts
decisions:
  - "Import from 'unpdf' (not 'unpdf/serverless') — v1.4.0 has no serverless sub-path export; Node 24 has no Promise.withResolvers issue"
  - "extractText returns { totalPages, text: string[] } with mergePages:false — adapted from plan's assumed pages[] API"
  - "isScannedPdf uses every-page-below-threshold (not any-page) per plan interface spec"
  - "mammoth types work natively — @ts-expect-error not needed"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
  tests_passing: 15
---

# Phase 02 Plan 02: Document Parsing Library Summary

**One-liner:** Four pure-function document parsing modules — unpdf PDF extraction with scanned heuristic, mammoth DOCX extraction, AWS Textract 10MB-gated OCR wrapper, and regex-based RFP section/requirement extraction — with 15 real tests passing.

## What Was Built

### Task 1: PDF, DOCX, and Textract modules

**`src/lib/documents/parse-pdf.ts`**
- `extractPdfText(buffer: Uint8Array)` — calls unpdf `extractText()` with `mergePages: false`, returns `{ text, pageCount, charPerPage }`
- `isScannedPdf(charPerPage: number[], threshold?)` — returns true if every page is below 100-char threshold (empty charPerPage also true)
- Import is from `'unpdf'` (not `'unpdf/serverless'`): version 1.4.0 has no serverless sub-path; Node 24 supports `Promise.withResolvers` natively

**`src/lib/documents/parse-docx.ts`**
- `extractDocxText(buffer: Buffer)` — calls mammoth `extractRawText({ buffer })`, returns plain text string
- mammoth types work natively in this project (no ts-expect-error needed)

**`src/lib/documents/textract.ts`**
- `extractTextract(fileBytes: Uint8Array)` — AWS Textract `DetectDocumentTextCommand` sync wrapper
- Guards against 10MB limit before making any API call: throws descriptive error with file size in MB
- Client instantiated per-call (credentials from env vars at runtime)

### Task 2: RFP structure extraction + all tests filled

**`src/lib/documents/rfp-structure.ts`**
- `extractRfpStructure(text: string)` — regex heuristic returning `{ sections: RfpSection[], requirements: RfpRequirement[] }`
- Section pattern matches: `SECTION C - ...`, `1.0 Scope of Work`, `C.1 General Requirements`
- Requirement pattern: splits text into sentences, checks for `shall/must/will/should` keywords with full type classification
- Returns empty arrays for structureless plain text

**Tests filled (was all `it.todo` stubs):**
- `tests/documents/parse-pdf.test.ts` — 7 real tests: extractPdfText on fixture, pageCount, isScannedPdf with explicit arrays + scanned fixture
- `tests/documents/parse-docx.test.ts` — 2 real tests: text extraction from fixture, empty buffer rejection
- `tests/documents/rfp-structure.test.ts` — 6 real tests: section detection, shall/must/will extraction, type classification, empty input, Section L/M pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] unpdf 'serverless' import path does not exist in v1.4.0**
- **Found during:** Task 1, checking package.json exports
- **Issue:** Plan specified `import { extractText } from 'unpdf/serverless'` but unpdf 1.4.0 only exports `.` and `./pdfjs` — no `serverless` path
- **Fix:** Import from `'unpdf'` directly. Node 24.13.1 supports `Promise.withResolvers` natively, so the original concern is moot
- **Files modified:** src/lib/documents/parse-pdf.ts
- **Commit:** 105f676

**2. [Rule 1 - Bug] unpdf extractText API returns `{ totalPages, text: string[] }` not `result.pages`**
- **Found during:** Task 1, reading type definitions
- **Issue:** Plan assumed `result.pages` array; actual API uses `result.text` (string[] when mergePages:false)
- **Fix:** `result.text` instead of `result.pages ?? []`
- **Files modified:** src/lib/documents/parse-pdf.ts
- **Commit:** 105f676

**3. [Rule 1 - Bug] Removed unnecessary `@ts-expect-error` directive**
- **Found during:** TypeScript check after Task 1
- **Issue:** `// @ts-expect-error mammoth CJS default` caused TS2578 (unused directive) because mammoth types work fine
- **Fix:** Removed the directive
- **Files modified:** src/lib/documents/parse-docx.ts
- **Commit:** 4269718

## Known Stubs

None — all four modules have complete implementations wired to real libraries (unpdf, mammoth, @aws-sdk/client-textract). No placeholder data flowing to UI.

## Pre-existing Issues (Out of Scope)

`supabase/functions/process-documents/index.ts` has Deno/ESM TypeScript errors — these are pre-existing from Plan 02-01 and are the Supabase Edge Function's Deno-specific imports. Out of scope for this plan.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 105f676 | feat(02-02): PDF/DOCX/Textract parsing library modules |
| 2 | 4269718 | feat(02-02): RFP structure extraction + all document test files |

## Self-Check: PASSED
