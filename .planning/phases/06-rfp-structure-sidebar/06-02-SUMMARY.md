---
phase: 06-rfp-structure-sidebar
plan: "02"
subsystem: editor
tags: [sidebar, rfp-structure, tiptap, navigation, react, scroll, active-section]

# Dependency graph
requires:
  - phase: 06-01
    provides: RfpStructureSidebar component with activeRfpSection and onSectionClick props interface
  - phase: 04-proposal-drafting-editor
    provides: ProposalEditor with editorRef (SectionEditorHandle) giving access to Tiptap Editor instance
provides:
  - Bidirectional navigation: sidebar click scrolls editor, editor scroll highlights sidebar
  - activeRfpSection state tracking via Tiptap selectionUpdate and update events
  - Click-to-scroll via editor.commands.setTextSelection + scrollIntoView
  - Auto-scroll sidebar list to keep active section visible via data-section attribute query
affects: [src/components/editor/ProposalEditor.tsx, src/components/editor/RfpStructureSidebar.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Editor event listeners via editor.on('selectionUpdate') and editor.on('update') with cleanup in useEffect"
    - "doc.nodesBetween(0, from) walk to find nearest heading above cursor"
    - "doc.descendants() walk to find first heading matching section title"
    - "data-section attribute + querySelector for DOM-to-state binding in sidebar auto-scroll"
    - "500ms mount-delay useEffect to handle editor ref not available on first render"

key-files:
  created: []
  modified:
    - src/components/editor/ProposalEditor.tsx
    - src/components/editor/RfpStructureSidebar.tsx

key-decisions:
  - "Editor events (selectionUpdate + update) are wired in a useEffect that returns cleanup — prevents stale event listeners on section tab switch"
  - "doc.nodesBetween(0, from) not doc.nodesBetween(0, doc.content.size) — only look backwards from cursor to avoid false positives from sections below cursor"
  - "500ms delay on mount useEffect re-runs on activeSection change (tab switch) so active section resets when switching proposal sections"
  - "onSectionClick called before toggleSection in sidebar onClick — scroll fires before DOM expand, preventing scroll position interference"
  - "data-section attribute on role=listitem div (not the button) — scrollIntoView targets the row container, not just the button"

patterns-established:
  - "Tiptap editor event binding pattern: useEffect with editor.on/off cleanup"
  - "Bidirectional state sync pattern: parent owns activeRfpSection, passes down to both editor (detects) and sidebar (displays)"

requirements-completed: [SIDEBAR-05, SIDEBAR-06]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 6 Plan 02: RFP Structure Sidebar — Navigation Wiring Summary

**Bidirectional navigation between sidebar and Tiptap editor: click-to-scroll via doc.descendants heading search plus active section detection via selectionUpdate event walking doc.nodesBetween**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-03-24T20:41:38Z
- **Completed:** 2026-03-24T20:43:38Z
- **Tasks:** 2 auto + 1 checkpoint (auto-approved)
- **Files modified:** 2

## Accomplishments

- ProposalEditor now tracks `activeRfpSection` state by listening to Tiptap `selectionUpdate` and `update` events, walking the document backwards from the cursor to find the nearest matching heading
- Click-to-scroll implemented via `handleRfpSectionClick`: traverses `doc.descendants` to find first heading containing the section title, then calls `setTextSelection` + `scrollIntoView` + `focus`
- RfpStructureSidebar auto-scrolls its own list to keep the active section row visible using a `data-section` attribute query and `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`

## Task Commits

Each task was committed atomically:

1. **Task 1: Active RFP section tracking and click-to-scroll in ProposalEditor** - `85904f1` (feat)
2. **Task 2: Wire onSectionClick and auto-scroll in RfpStructureSidebar** - `30c721b` (feat)
3. **Task 3: Human verify checkpoint** — auto-approved (auto mode active)

## Files Created/Modified

- `src/components/editor/ProposalEditor.tsx` - Added activeRfpSection state, handleRfpSectionClick callback, detectActiveRfpSection callback, editor event useEffect, mount-delay useEffect, and updated RfpStructureSidebar JSX to pass new props
- `src/components/editor/RfpStructureSidebar.tsx` - Added useRef/useEffect imports, listRef for scroll container, useEffect for auto-scroll, data-section attribute on row divs, ref on list container, updated onClick to call onSectionClick first

## Decisions Made

- `editor.on('selectionUpdate')` and `editor.on('update')` both wired — selectionUpdate handles cursor movement, update handles content changes that move position
- `doc.nodesBetween(0, from)` used for active section detection (walk only the document up to cursor, not full doc) — prevents sections below cursor from being falsely detected
- 500ms delay on mount useEffect re-runs when `activeSection` changes (tab switch dependency) so active highlighting resets correctly per proposal section tab
- `onSectionClick?.(section.title)` called before `toggleSection(section.number)` — scroll fires before expand animation, avoiding scroll position interference

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `tiptap-to-pdf.ts` and `pdf/route.ts` — confirmed out of scope per 06-01-SUMMARY.md. No new errors introduced.

## Known Stubs

None. Full bidirectional navigation is wired. The `activeRfpSection` state is populated by real editor events, not hardcoded.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 6 is complete. The full RFP Structure Sidebar feature is implemented:
- Toggle open/close (Plan 01)
- Section list with titles and requirement count badges (Plan 01)
- Expand/collapse individual sections to see requirements (Plan 01)
- Click-to-scroll navigation from sidebar to editor (Plan 02)
- Active section highlighting as user scrolls/navigates (Plan 02)

No blockers. v1.1 milestone complete.

## Self-Check: PASSED

- [x] `src/components/editor/ProposalEditor.tsx` modified with activeRfpSection state, handlers, and useEffects
- [x] `src/components/editor/RfpStructureSidebar.tsx` modified with listRef, useEffect, data-section, ref
- [x] Commit 85904f1 exists (Task 1)
- [x] Commit 30c721b exists (Task 2)
- [x] TypeScript reports no new errors in modified files

---
*Phase: 06-rfp-structure-sidebar*
*Completed: 2026-03-24*
