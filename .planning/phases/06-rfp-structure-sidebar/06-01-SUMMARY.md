---
phase: 06-rfp-structure-sidebar
plan: "01"
subsystem: editor
tags: [sidebar, rfp-structure, ui, react, accessibility]
dependency_graph:
  requires: [proposals.rfp_structure JSONB column (Phase 2), ProposalEditor layout (Phase 4)]
  provides: [RfpStructureSidebar component, rfp_structure data plumbing in editor page]
  affects: [src/components/editor/ProposalEditor.tsx, src/app/(dashboard)/proposals/[id]/editor/page.tsx]
tech_stack:
  added: []
  patterns: [client-side toggle state, Set-based expand/collapse state, conditional Tailwind classes, inline SVG icons, aria-expanded, role=complementary]
key_files:
  created:
    - src/components/editor/RfpStructureSidebar.tsx
  modified:
    - src/app/(dashboard)/proposals/[id]/editor/page.tsx
    - src/components/editor/ProposalEditor.tsx
decisions:
  - Active section highlighting wired with border-l-2 border-blue-700 but activeRfpSection defaults to null until Plan 02 provides click-to-scroll linkage
  - Collapsed state uses separate early-return branch (not conditional className) to avoid rendering the full expanded DOM tree when collapsed
  - Pre-existing TypeScript errors in tiptap-to-pdf.ts and pdf/route.ts are out of scope — confirmed present before this plan's changes
metrics:
  duration: "4 minutes"
  completed: "2026-03-24"
  tasks: 2
  files: 3
---

# Phase 6 Plan 01: RFP Structure Sidebar — Data Plumbing and Component Summary

RfpStructureSidebar component with toggle/expand/collapse wired into editor layout via rfp_structure prop from existing Supabase query.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Data plumbing — rfp_structure added to editor page .select(), cast, passed through ProposalEditor props | dd20a2d | editor/page.tsx, ProposalEditor.tsx |
| 2 | RfpStructureSidebar component — display, toggle, expand/collapse | 617e782 | RfpStructureSidebar.tsx |

## What Was Built

**Task 1:** Added `rfp_structure` to the existing Supabase `.select()` call in `editor/page.tsx`. Imported `RfpStructure` type, extracted and cast the raw JSONB value, and forwarded it as `rfpStructure` prop to `ProposalEditor`. No new API calls introduced. Updated `ProposalEditor` Props interface to accept `rfpStructure: RfpStructure | null`, added import of `RfpStructureSidebar`, and rendered it as the first child of the editor layout `<div className="flex gap-0">`.

**Task 2:** Created `src/components/editor/RfpStructureSidebar.tsx` (211 lines) as a `'use client'` component. The sidebar:
- Starts expanded (`w-64`), collapses to a `w-10` strip with a right-pointing double-chevron toggle button
- Expanded header shows "RFP Structure" label and collapse toggle
- Lists all parsed RFP sections with section title and requirement count badge
- Each section row has `aria-expanded`, expand/collapse chevron, and border-left active-state slot for Plan 02
- Clicking a section row expands it to show individual requirements (truncated at 100 chars with `...`)
- Empty state when `rfpStructure` is null or has zero sections
- Full accessibility: `role="complementary"`, `aria-label="RFP structure panel"`, `role="list"`, `role="listitem"`, `aria-label` on both toggle buttons

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The `activeRfpSection` prop defaults to `null` (no active highlighting) — this is intentional and documented in the plan. Plan 02 will wire click-to-scroll to populate this value.

## Self-Check: PASSED

- [x] `src/components/editor/RfpStructureSidebar.tsx` exists
- [x] Commit dd20a2d exists (Task 1)
- [x] Commit 617e782 exists (Task 2)
- [x] `rfp_structure` in editor page `.select()` — confirmed
- [x] `rfpStructure` prop in ProposalEditor interface — confirmed
- [x] `<RfpStructureSidebar` rendered in ProposalEditor — confirmed
- [x] All acceptance criteria in plan met — confirmed via grep
