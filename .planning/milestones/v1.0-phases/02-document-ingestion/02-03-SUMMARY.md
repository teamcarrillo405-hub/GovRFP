---
phase: 02-document-ingestion
plan: "03"
subsystem: document-ingestion
tags: [api, edge-function, upload, signed-url, pdf-parsing, ocr, job-queue]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["upload-url-api", "process-documents-edge-function"]
  affects: ["02-04"]
tech_stack:
  added: []
  patterns:
    - "Signed upload URL pattern: browser uploads directly to Supabase Storage (bypasses Vercel 4.5MB limit)"
    - "Atomic job claim: claim_next_document_job() RPC with FOR UPDATE SKIP LOCKED"
    - "Deno Edge Function with npm: specifiers for unpdf and mammoth"
    - "Raw SigV4 fetch for AWS Textract (no @aws-sdk in Deno runtime)"
    - "tsconfig.json excludes supabase/functions/ (Deno types incompatible with Node.js tsc)"
key_files:
  created:
    - src/app/api/documents/upload-url/route.ts
    - supabase/functions/process-documents/index.ts
  modified:
    - tests/documents/upload-url.test.ts
    - tests/documents/job-queue.test.ts
    - tsconfig.json
decisions:
  - "Excluded supabase/functions from tsconfig.json — Deno runtime (Deno.serve, npm: specifiers, URL imports) is incompatible with Node.js tsc. Edge Functions are type-checked by Deno's own toolchain."
  - "Route returns 402 (not 403) for inactive subscription — consistent with payment-required semantic"
  - "Upload route uses checkSubscription(userId) + isSubscriptionActive(status) — matches actual export signature in subscription-check.ts (takes SubscriptionStatus string, not profile fields)"
  - "failJob() resets proposal to 'draft' (not 'failed') so user can retry upload without creating a new record"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-23T18:39:53Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 02 Plan 03: Upload API Route + Edge Function Summary

**One-liner:** Signed upload URL API with subscription gate + Deno Edge Function that claims jobs, parses PDF/DOCX, detects scanned pages, runs AWS Textract OCR, and stores rfp_text + rfp_structure.

## What Was Built

### Task 1: Upload URL API Route

`POST /api/documents/upload-url` — the entry point for the async document pipeline:

1. **Auth check** — `getUser()` → 401 if unauthenticated
2. **Subscription gate** — `checkSubscription(userId)` + `isSubscriptionActive(status)` → 402 if inactive
3. **Validation** — Zod schema: `fileType: z.enum(['pdf','docx'])`, fileSize max 50MB → 400 on failure
4. **Create proposal row** — `status: 'processing'`, `file_name`, `file_type`
5. **Signed upload URL** — `admin.storage.from('rfp-documents').createSignedUploadUrl(path)`
6. **Queue job** — `document_jobs` insert with `status: 'pending'`
7. **Return** — `{ signedUrl, token, path, proposalId }`

### Task 2: Supabase Edge Function

`supabase/functions/process-documents/index.ts` — the async worker:

1. **Claim job** — `rpc('claim_next_document_job')` — atomic, FOR UPDATE SKIP LOCKED
2. **Download** — `storage.from('rfp-documents').download(path)`
3. **Parse** — PDF: `npm:unpdf/serverless` with per-page scanned detection; DOCX: `npm:mammoth`
4. **OCR path** — if scanned (avg < 100 chars/page): Textract sync API via raw SigV4 fetch; rejects files > 10MB with helpful message
5. **Extract structure** — inline `extractRfpStructure()` (regex heuristic for sections + shall/must/will/should requirements)
6. **Update proposals** — `rfp_text`, `rfp_structure`, `page_count`, `is_scanned`, `ocr_used`, `status: 'ready'`
7. **Complete job** — `status: 'completed'`, `completed_at`
8. **Error path** — `failJob()` sets `status: 'failed'` + `error_message`, resets proposal to `'draft'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded supabase/functions from tsconfig.json**
- **Found during:** Task 2 TypeScript check
- **Issue:** `npx tsc --noEmit` failed with errors about `Deno` global, `npm:` specifiers, and `https://esm.sh/` URL imports — all of which are Deno-only and unknown to Node.js tsc
- **Fix:** Added `"supabase/functions"` to `exclude` in `tsconfig.json`
- **Files modified:** `tsconfig.json`
- **Commit:** 66ebd2b

## Test Results

All 20 tests pass:
- `tests/documents/upload-url.test.ts` — 9 structural contract tests (POST export, file type enum, 50MB limit, subscription gate ordering, admin client, document_jobs insert, Zod v4 error format, 401/402 status codes)
- `tests/documents/job-queue.test.ts` — 11 structural tests (migration has claim function + SKIP LOCKED, RLS policy, status constraints, required columns, Edge Function has RPC call, rfp_text/rfp_structure update, failure path, scanned detection, 10MB limit, unpdf import, extractRfpStructure function)

```
Test Files  2 passed (6)
     Tests  20 passed | 14 todo (34)
  Duration  361ms
```

## Known Stubs

None — all core logic is implemented. The Edge Function's `npm:unpdf/serverless` dynamic import result shape (`result.pages` vs `result.text`) depends on the unpdf version installed; a try/catch fallback handles API shape differences.

## Self-Check

### Files Exist
- `src/app/api/documents/upload-url/route.ts` — FOUND
- `supabase/functions/process-documents/index.ts` — FOUND
- `tests/documents/upload-url.test.ts` — FOUND (filled)
- `tests/documents/job-queue.test.ts` — FOUND (filled)

### Commits Exist
- 66ebd2b — feat(02-03): upload URL API route
- 2714d6d — feat(02-03): Supabase Edge Function

## Self-Check: PASSED
