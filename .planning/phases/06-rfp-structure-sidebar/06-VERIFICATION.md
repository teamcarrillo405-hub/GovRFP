---
phase: 06-rfp-structure-sidebar
verified: 2026-03-24T21:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Navigate to a proposal with rfp_structure data at /proposals/{id}/editor. Confirm sidebar appears on the left with 'RFP Structure' header showing section titles and requirement count badges."
    expected: "Sidebar visible, w-64 width, header reads 'RFP Structure', each parsed section shows title and count number to the right"
    why_human: "UI rendering and visual layout cannot be verified programmatically"
  - test: "Click the collapse chevron (<<) in the sidebar header. Then click the expand chevron (>>) on the strip."
    expected: "Sidebar shrinks to w-10 strip with smooth 200ms transition; expands back to w-64 with same animation"
    why_human: "CSS transition timing and visual width change require browser rendering"
  - test: "Click a section row in the sidebar."
    expected: "Section expands to show requirements AND the Tiptap editor scrolls to the matching heading"
    why_human: "Scroll behavior and editor DOM interaction require a running browser"
  - test: "Move the cursor through different headings in the editor (click into different proposal sections)."
    expected: "The matching RFP section in the sidebar updates to show a blue left border and blue title text"
    why_human: "Tiptap selectionUpdate event behavior and live state sync require a running app"
  - test: "Open a proposal that has NOT been analyzed (rfp_structure is null)."
    expected: "Sidebar shows empty state: 'No structure found' with the explanation text"
    why_human: "Requires a specific database record state to test"
---

# Phase 6: RFP Structure Sidebar Verification Report

**Phase Goal:** Contractors can see the parsed RFP outline at all times while editing their proposal and navigate directly to any section
**Verified:** 2026-03-24T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User opens editor and sees sidebar listing every parsed RFP section with title and requirement count badge, without additional API calls | VERIFIED | `editor/page.tsx` line 31: `rfp_structure` added to existing `.select()` call; `RfpStructureSidebar` renders title + count badge at lines 187–191 in sidebar; no new fetch/API call introduced |
| 2 | User clicks toggle button and sidebar smoothly opens or closes, editor expands to fill reclaimed space | VERIFIED | `isExpanded` state toggles between `w-64` and `w-10` with `transition-all duration-200 ease-in-out`; ProposalEditor editor column is `flex-1 min-w-0` — reclaims space automatically |
| 3 | User clicks a section heading in sidebar and proposal editor scrolls to that section | VERIFIED | `handleRfpSectionClick` in `ProposalEditor.tsx` lines 174–192: `doc.descendants` finds heading node, `setTextSelection` + `scrollIntoView` + `focus` execute; `onSectionClick` wired at line 328 |
| 4 | User scrolls through proposal editor and currently visible section is highlighted in sidebar automatically | VERIFIED | `detectActiveRfpSection` in `ProposalEditor.tsx` lines 195–215: `editor.on('selectionUpdate')` and `editor.on('update')` both wired with cleanup; `activeRfpSection` passed to sidebar at line 327; `border-l-2 border-blue-700` applied at line 141 when active |
| 5 | User expands a section to see individual requirements, can collapse to hide them | VERIFIED | `expandedSections` Set state with `toggleSection` handler; `isSectionExpanded` conditional at line 195 renders requirements list; `aria-expanded` on button |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/editor/RfpStructureSidebar.tsx` | Sidebar with toggle, section list, expand/collapse | VERIFIED | 220 lines (min 80); `'use client'` directive; all accessibility attrs present; active highlighting wired |
| `src/app/(dashboard)/proposals/[id]/editor/page.tsx` | Selects `rfp_structure`, passes to ProposalEditor | VERIFIED | Line 31: `rfp_structure` in `.select()`; line 41: cast to `RfpStructure | null`; line 85: `rfpStructure={rfpStructure}` prop passed |
| `src/components/editor/ProposalEditor.tsx` | Renders RfpStructureSidebar left of editor column, accepts rfpStructure prop, owns active section state | VERIFIED | Line 15: import; line 30: prop in interface; lines 325–329: `<RfpStructureSidebar rfpStructure={rfpStructure} activeRfpSection={activeRfpSection} onSectionClick={handleRfpSectionClick} />`; editor event wiring at lines 218–230 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `editor/page.tsx` | `ProposalEditor.tsx` | `rfpStructure` prop | WIRED | `rfpStructure={rfpStructure}` at line 85 of page.tsx |
| `ProposalEditor.tsx` | `RfpStructureSidebar.tsx` | Renders sidebar with rfpStructure data | WIRED | `<RfpStructureSidebar rfpStructure={rfpStructure} ...>` at lines 325–329 |
| `ProposalEditor.tsx` | `RfpStructureSidebar.tsx` | `activeRfpSection` prop and `onSectionClick` callback | WIRED | Both props present at lines 327–328; state owned by ProposalEditor, populated by editor events |
| `ProposalEditor.tsx` | Tiptap editor (via editorRef) | `editor.on('selectionUpdate')` + `editor.on('update')` | WIRED | Lines 222–228: both events bound with cleanup in useEffect |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RfpStructureSidebar.tsx` | `rfpStructure.sections` | Supabase query in `editor/page.tsx` → prop chain | Yes — reads `rfp_structure` JSONB column set during Phase 2 document parsing | FLOWING |
| `RfpStructureSidebar.tsx` | `activeRfpSection` | `detectActiveRfpSection` callback → Tiptap `editor.state.selection` | Yes — driven by real cursor position in editor DOM | FLOWING |
| `ProposalEditor.tsx` | `activeRfpSection` state | Editor `selectionUpdate`/`update` events → `nodesBetween` walk | Yes — real-time doc walk, not hardcoded | FLOWING |

### Behavioral Spot-Checks

Step 7b skipped for UI components — no runnable API endpoints to test in isolation. All sidebar and navigation code runs inside a browser-rendered Tiptap editor context. Routed to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIDEBAR-01 | 06-01-PLAN | User sees collapsible RFP structure sidebar in proposal editor showing parsed sections and requirements | SATISFIED | `RfpStructureSidebar` renders in editor layout; sections listed with titles; `isExpanded` state enables collapse |
| SIDEBAR-02 | 06-01-PLAN | User can toggle sidebar open/closed via button in editor | SATISFIED | Collapse button: `aria-label="Collapse RFP sidebar"`; expand button: `aria-label="Expand RFP sidebar"`; both toggle `isExpanded` state |
| SIDEBAR-03 | 06-01-PLAN | User sees each RFP section listed with title and requirement count badge | SATISFIED | Section title at line 187 with `flex-1 truncate`; count badge at line 191: `{count}` from `getRequirementsForSection` |
| SIDEBAR-04 | 06-01-PLAN | User can expand/collapse individual sections to reveal associated requirements | SATISFIED | `expandedSections` Set + `toggleSection`; requirements rendered conditionally at line 195 |
| SIDEBAR-05 | 06-02-PLAN | User can click section heading in sidebar to scroll proposal editor to that section | SATISFIED | `handleRfpSectionClick` searches `doc.descendants` for heading text match, then `setTextSelection` + `scrollIntoView` + `focus`; wired via `onSectionClick` prop |
| SIDEBAR-06 | 06-02-PLAN | Active proposal section highlighted in sidebar as user scrolls through editor | SATISFIED | `detectActiveRfpSection` walks `doc.nodesBetween(0, from)` on `selectionUpdate`/`update` events; `border-l-2 border-blue-700` + `text-blue-700` applied when `isActive` |
| SIDEBAR-07 | 06-01-PLAN | Sidebar reads `rfp_structure` JSONB from proposals table — no new API calls required | SATISFIED | Line 31 of page.tsx: `rfp_structure` added to existing `.select()` call; no new `fetch()` or route added; data passed through props only |

**Orphaned requirements check:** REQUIREMENTS.md maps all 7 SIDEBAR-* IDs to Phase 6. All 7 claimed in plan frontmatter (SIDEBAR-01–04, SIDEBAR-07 in 06-01; SIDEBAR-05–06 in 06-02). No orphans.

**Coverage:** 7/7 requirements satisfied

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No stubs, placeholders, or disconnected data paths found in Phase 6 files |

Note: TypeScript compile errors exist in `src/lib/export/tiptap-to-pdf.ts`, `src/app/api/proposals/[id]/export/pdf/route.ts`, and their test files. These are pre-existing Phase 5 errors confirmed out of scope in both 06-01-SUMMARY.md and 06-02-SUMMARY.md. No new TypeScript errors introduced by Phase 6.

### Human Verification Required

The following behaviors require browser testing with a real running dev server. All underlying code logic is verified; only runtime behavior is unconfirmed.

#### 1. Sidebar Visual Rendering

**Test:** Navigate to `/proposals/{id}/editor` for a proposal with rfp_structure data (an analyzed proposal).
**Expected:** Sidebar appears on the left, 256px wide, with "RFP Structure" header. Each parsed section shows title text and a numeric count badge. Three-column layout: [Sidebar w-64] | [Editor flex-1] | [CompliancePanel w-80].
**Why human:** UI layout, column sizing, and visual alignment cannot be verified programmatically.

#### 2. Sidebar Toggle Animation

**Test:** Click the collapse button (double-left chevron) in the sidebar header. Then click the single expand button (double-right chevron) on the narrow strip.
**Expected:** Sidebar smoothly animates from 256px to 40px in 200ms. Click expand — animates back to 256px. Editor column expands visibly to fill the reclaimed width.
**Why human:** CSS transition timing and visual width change require browser rendering.

#### 3. Click-to-Scroll Navigation

**Test:** Open an analyzed proposal in the editor. Click any section name in the RFP sidebar.
**Expected:** The Tiptap editor scrolls to the heading matching that section title, AND the section in the sidebar expands to show its requirements.
**Why human:** Tiptap DOM manipulation and scroll behavior require a running browser with editor content loaded.

#### 4. Active Section Highlighting

**Test:** With the editor open, click into different headings or use keyboard navigation to move through the document.
**Expected:** The sidebar section matching the current cursor position shows a blue left border (`border-blue-700`) and blue title text. Updates automatically without any click.
**Why human:** Requires live Tiptap `selectionUpdate` event firing and React state updates in a browser context.

#### 5. Empty State

**Test:** Open the editor for a proposal whose `rfp_structure` column is null or has zero sections.
**Expected:** Sidebar displays "No structure found" with the explanation text about the Analysis tab.
**Why human:** Requires a specific database record with null `rfp_structure`.

### Gaps Summary

No gaps. All five success criteria from ROADMAP.md are fully implemented and verified at the code level. All seven requirement IDs are satisfied. All four commits exist. TypeScript has no new errors in Phase 6 files.

The phase status is `human_needed` because the bidirectional navigation (SIDEBAR-05, SIDEBAR-06) and the toggle animation (SIDEBAR-02) involve Tiptap editor events and CSS transitions that can only be confirmed by running the application in a browser.

---

_Verified: 2026-03-24T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
