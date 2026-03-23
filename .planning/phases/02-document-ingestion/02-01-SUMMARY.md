---
phase: 02-document-ingestion
plan: 01
subsystem: document-ingestion-foundation
tags: [packages, migration, test-stubs, fixtures, wave-0]
dependency_graph:
  requires: [01-05-SUMMARY.md]
  provides: [unpdf, mammoth, @aws-sdk/client-textract, document_jobs schema, test harness]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: [unpdf@1.4.0, mammoth@1.12.0, @aws-sdk/client-textract, archiver (dev)]
  patterns: [it.todo stubs, minimal PDF spec, OOXML/ZIP DOCX generation]
key_files:
  created:
    - supabase/migrations/00002_document_ingestion.sql
    - tests/documents/parse-pdf.test.ts
    - tests/documents/parse-docx.test.ts
    - tests/documents/rfp-structure.test.ts
    - tests/documents/upload-url.test.ts
    - tests/documents/job-queue.test.ts
    - tests/fixtures/sample.pdf
    - tests/fixtures/sample-scanned.pdf
    - tests/fixtures/sample.docx
    - tests/fixtures/generate-docx.mjs
  modified:
    - package.json
    - package-lock.json
    - .env.local.example
    - tsconfig.json
decisions:
  - Used archiver (dev dep) instead of archiver-less approach -- creates valid ZIP/OOXML DOCX without native bindings
  - Fixed tsconfig.json target ES2017->ES2018 to allow s-flag regex already used in existing Phase 1 tests
  - PDF fixtures created as raw PDF 1.0 spec text (no binary generator needed for minimal valid structure)
metrics:
  duration: 8 minutes
  completed: 2026-03-23T18:31:00Z
  tasks_completed: 2
  files_created: 10
  files_modified: 4
---

# Phase 2 Plan 1: Document Ingestion Foundation Summary

Wave 0 foundation for Phase 2: npm packages installed, document_jobs DB schema defined, 5 test stubs and 3 fixture files in place.

## What Was Built

### Packages Installed
- `unpdf` — PDF text extraction (import from `unpdf/serverless` in Wave 1 to avoid Node 20 crash)
- `mammoth` — DOCX raw text extraction
- `@aws-sdk/client-textract` — AWS OCR for scanned PDFs
- `archiver` (dev) — ZIP creation for DOCX fixture generation

### Database Migration: `supabase/migrations/00002_document_ingestion.sql`
- Extends `proposals` table: `file_name`, `file_type`, `storage_path`, `rfp_text`, `rfp_structure`, `page_count`, `is_scanned`, `ocr_used`
- Creates `document_jobs` table with full status lifecycle: `pending -> processing -> completed | failed`
- RLS enabled: `"Users can view own document_jobs"` policy with cached `auth.uid()`
- 3 performance indexes: `(status, created_at)`, `(proposal_id)`, `(user_id)`
- `claim_next_document_job()` function: `SECURITY DEFINER`, atomic row locking with `FOR UPDATE SKIP LOCKED` to prevent double-processing

### Test Stubs (5 files, 16 todos)
All stubs in `tests/documents/` use `it.todo()` — they skip cleanly without failing. Wave 1 plans (02-02, 02-03) will fill them in.

| File | Todos |
|------|-------|
| parse-pdf.test.ts | 4 |
| parse-docx.test.ts | 2 |
| rfp-structure.test.ts | 3 |
| upload-url.test.ts | 4 |
| job-queue.test.ts | 3 |

### Fixtures (3 files)
- `tests/fixtures/sample.pdf` — minimal PDF 1.0 with text stream (`BT /F1 12 Tf ... (Sample RFP) Tj ET`)
- `tests/fixtures/sample-scanned.pdf` — minimal PDF 1.0 with no text content (page has no /Contents)
- `tests/fixtures/sample.docx` — valid OOXML ZIP with `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/_rels/document.xml.rels`; contains two-paragraph government-style scope text

### Environment
Added to `.env.local.example`:
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tsconfig.json ES2017 -> ES2018**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** `target: "ES2017"` caused TS1501 errors on regex `s` (dotAll) flag used in Phase 1 tests. tsc --noEmit was failing before this plan's changes, making the acceptance criterion impossible to meet.
- **Fix:** Changed `target` from `"ES2017"` to `"ES2018"` in tsconfig.json. ES2018 is the minimum required for the `s` flag per the TypeScript spec.
- **Files modified:** `tsconfig.json`
- **Commit:** `11bd428`

**2. [Rule 3 - Blocking] Used archiver instead of no-dep ZIP approach**
- **Found during:** Task 2 fixture generation
- **Issue:** Plan referenced `archiver` but it was not installed. The `docx` npm package referenced in CLAUDE.md was also not in package.json.
- **Fix:** Installed `archiver` as dev dependency and `@types/archiver`. The generator script (`generate-docx.mjs`) runs once to produce `sample.docx`.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `8853d6c`

## Verification Results

```
npx tsc --noEmit     -> 0 errors (clean)
npx vitest run tests/documents/  -> 5 skipped, 16 todos, 0 failures
node -e "require('unpdf'); require('mammoth'); require('@aws-sdk/client-textract'); console.log('OK')"  -> OK
test -f supabase/migrations/00002_document_ingestion.sql  -> Migration exists
```

## Commits

| Hash | Message |
|------|---------|
| `11bd428` | feat(02-01): install Phase 2 packages, create document_jobs migration, update env |
| `8853d6c` | feat(02-01): create Wave 0 test stubs and fixture files |

## Self-Check: PASSED
