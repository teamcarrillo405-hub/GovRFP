---
phase: 02-document-ingestion
plan: "04"
subsystem: document-ingestion-ui
tags: [upload, realtime, nextjs, supabase, tailwind]
dependency_graph:
  requires: ["02-02", "02-03"]
  provides: ["INGEST-01", "INGEST-02", "INGEST-04"]
  affects: ["03-rfp-analysis"]
tech_stack:
  added: []
  patterns:
    - "Supabase Realtime postgres_changes filtered by proposal_id"
    - "Direct binary PUT to Supabase Storage signed URL (bypass Vercel 4.5MB limit)"
    - "Next.js 16 awaited params in server page props"
    - "Subscription gate pattern: checkSubscription + isSubscriptionActive in server page"
key_files:
  created:
    - src/components/documents/FileUpload.tsx
    - src/components/documents/ProcessingStatus.tsx
    - src/app/(dashboard)/proposals/new/page.tsx
    - src/app/(dashboard)/proposals/[id]/page.tsx
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
decisions:
  - "Default export (not named) for page-level components to match Next.js convention; named exports for utility components would also work but default is idiomatic for pages"
  - "ProcessingStatus reloads window on completed status so RSC re-fetches rfp_text/rfp_structure from DB — avoids client-side state sync complexity"
  - "Auto-fixed TS5076: ?? and > operator precedence in rfp_structure section/requirement length checks — added explicit parentheses"
metrics:
  duration: "4 min"
  completed_date: "2026-03-23"
  tasks: 2
  files: 5
---

# Phase 2 Plan 4: Upload UI + Proposal Pages Summary

Document ingestion frontend: FileUpload component with drag-and-drop and signed URL upload, ProcessingStatus with Supabase Realtime, /proposals/new server page with subscription gate, /proposals/[id] detail page, and dashboard updated with Upload RFP CTA.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | FileUpload + ProcessingStatus client components | d6ad3da | `src/components/documents/FileUpload.tsx`, `src/components/documents/ProcessingStatus.tsx` |
| 2 | Proposal pages + dashboard update | cf8c0a4 | `src/app/(dashboard)/proposals/new/page.tsx`, `src/app/(dashboard)/proposals/[id]/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx` |

## What Was Built

**FileUpload.tsx** — 'use client' component with:
- Drag-and-drop drop zone + "Browse files" button fallback
- File validation: MIME type check (PDF/DOCX), extension fallback, 50MB size limit, empty file check
- Fetches signed URL from `/api/documents/upload-url` with `{ fileName, fileType, fileSize }`
- Direct binary PUT to signed URL with `Content-Type` header
- Progress states: validating (0%) → uploading (10% → 30% → 100%)
- Navigates to `/proposals/{proposalId}` after successful upload
- Inline error display with "Try again" reset button
- SVG upload icon, no emojis, Tailwind v4 classes

**ProcessingStatus.tsx** — 'use client' component with:
- Supabase Realtime `postgres_changes` subscription on `document_jobs` table, filtered by `proposal_id=eq.{proposalId}`
- Live status transitions: pending → processing → completed / failed
- Animated spinner SVG for pending/processing states
- Check mark SVG for completed, warning triangle SVG for failed
- On `completed`: `window.location.reload()` so RSC re-fetches updated proposal data
- On `failed`: shows `error_message` + "Upload again" link to `/proposals/new`

**/proposals/new/page.tsx** — Server component:
- Auth guard via `getUser()`
- Subscription gate: `checkSubscription(user.id)` + `isSubscriptionActive(subscription.status)` — returns yellow warning card if inactive
- Renders `FileUpload` for active subscribers

**/proposals/[id]/page.tsx** — Server component:
- Auth guard + `await params` (Next.js 16 requirement)
- Loads proposal + most recent `document_jobs` row
- Shows `ProcessingStatus` when `proposal.status === 'processing'`
- Shows document info (type, pages, OCR flag), RFP structure summary (section count, requirements breakdown), extracted text preview (first 5000 chars) when `proposal.status === 'ready'`
- Draft/other states show empty state with upload link

**dashboard/page.tsx** — Updated:
- Added "Upload RFP" Link card as first grid item, `sm:col-span-2` (full-width on desktop), blue styling to distinguish as primary CTA
- Added "Recent Proposals" section below grid: queries 5 most recent, shows title, file name, colored status badge

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS5076 operator precedence in rfp_structure checks**
- **Found during:** Task 2 — tsc check after writing proposals/[id]/page.tsx
- **Issue:** `?? 0 > 0` in JSX conditions triggers TS5076 — `??` and `&&`/comparison operators cannot be mixed without parentheses
- **Fix:** Wrapped length expressions in parentheses: `(expr?.length ?? 0) > 0`
- **Files modified:** `src/app/(dashboard)/proposals/[id]/page.tsx`
- **Commit:** Included in cf8c0a4

## Verification Results

- `npx tsc --noEmit`: exits 0 (clean)
- `npx vitest run`: 138 tests passing (22 test files)

## Checkpoint

Task 3 was `checkpoint:human-verify`. Auto mode active (`workflow.auto_advance=true`) — auto-approved.

**What was built:** Complete document upload UI — FileUpload with drag-and-drop, ProcessingStatus with Realtime, /proposals/new with subscription gate, /proposals/[id] with processed document view, dashboard with Upload RFP CTA and recent proposals list.

## Known Stubs

None — all components are fully wired. The proposal detail page shows actual DB data (rfp_text, rfp_structure, is_scanned, page_count) once the Edge Function completes processing. The "RFP analysis will be available in Phase 3" is intentional scope deferral, not a stub.

## Self-Check: PASSED

All created files confirmed present. All commits confirmed in git log.
