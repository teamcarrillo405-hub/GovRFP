---
phase: 2
slug: document-ingestion
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 (existing from Phase 1) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/documents/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (unit + integration) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/documents/`
- **After every plan wave:** Run `npx vitest run` (full suite — must still be 34+ green)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | INGEST-01–05 | setup | `npx vitest run tests/documents/` | ❌ W0 | ⬜ pending |
| 2-xx-xx | TBD | TBD | INGEST-01 | unit | `npx vitest run tests/documents/upload-url.test.ts` | ❌ W0 | ⬜ pending |
| 2-xx-xx | TBD | TBD | INGEST-02 | unit | `npx vitest run tests/documents/parse-docx.test.ts` | ❌ W0 | ⬜ pending |
| 2-xx-xx | TBD | TBD | INGEST-03 | unit | `npx vitest run tests/documents/parse-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 2-xx-xx | TBD | TBD | INGEST-04 | integration | `npx vitest run tests/documents/job-queue.test.ts` | ❌ W0 | ⬜ pending |
| 2-xx-xx | TBD | TBD | INGEST-05 | unit | `npx vitest run tests/documents/rfp-structure.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All document test files are missing. The following must exist before execution begins:

- [ ] `tests/documents/upload-url.test.ts` — stubs for INGEST-01, INGEST-02 (upload URL API)
- [ ] `tests/documents/parse-pdf.test.ts` — stubs for INGEST-03 (scanned PDF detection heuristic)
- [ ] `tests/documents/parse-docx.test.ts` — stubs for INGEST-02 (mammoth.js extraction)
- [ ] `tests/documents/job-queue.test.ts` — stubs for INGEST-04 (claim_next_document_job RPC)
- [ ] `tests/documents/rfp-structure.test.ts` — stubs for INGEST-05 (section + requirement extraction)
- [ ] `tests/fixtures/sample.pdf` — digitally-born PDF fixture (2-page, has text)
- [ ] `tests/fixtures/sample-scanned.pdf` — scanned PDF fixture (0–30 chars per page)
- [ ] `tests/fixtures/sample.docx` — DOCX fixture (basic government format)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime WebSocket delivers job status update to browser | INGEST-04 | Requires live Supabase WebSocket connection — cannot mock in Vitest | Upload a test file, watch ProcessingStatus component in browser; confirm badge transitions from pending → processing → completed without page refresh |
| AWS Textract OCR returns readable text from scanned PDF | INGEST-03 | Requires AWS credentials + real scanned PDF file | Upload a scanned government PDF in dev environment with AWS credentials configured; confirm rfp_text column populated with readable content |
| Supabase Storage bucket correctly rejects files > 50MB | INGEST-01 | Requires live Supabase Storage with bucket size policy | Attempt upload of a >50MB file via the UI; confirm rejection at storage layer with user-visible error |
| pg_cron triggers Edge Function on schedule | INGEST-04 | Requires Supabase dashboard configuration + pg_net extension | Insert a pending document_jobs row manually; confirm Edge Function runs within 60 seconds and updates status to completed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** PASS (gsd-plan-checker 2026-03-23 — 0 blockers, 2 non-blocking warnings)
