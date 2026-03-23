---
phase: 04-proposal-drafting-editor
plan: 03
subsystem: editor
tags: [tiptap, prosemirror, mark-extension, compliance, vitest, typescript]

# Dependency graph
requires:
  - phase: 04-proposal-drafting-editor
    plan: 01
    provides: src/lib/editor/types.ts (SectionName, ComplianceCoverage), Tiptap v2 packages installed
  - phase: 03-rfp-analysis
    provides: AnalysisRequirement interface from src/lib/analysis/types.ts

provides:
  - src/lib/editor/extensions.ts: editorExtensions array (StarterKit h1-h3, Underline, Table suite, ComplianceGapMark)
  - src/lib/editor/compliance-gap-mark.ts: ComplianceGapMark Tiptap Mark + stripComplianceMarks utility
  - src/lib/editor/compliance-scanner.ts: scanCompliance pure function + extractText utility

affects:
  - 04-04: compliance live-link imports ComplianceGapMark and scanCompliance to apply marks
  - 04-05: export pipeline calls stripComplianceMarks before generating Word/PDF output

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN: tests committed in failing state, then implementation committed to pass"
    - "Tiptap Mark.create() pattern: name + addAttributes + parseHTML + renderHTML"
    - "Pure function compliance scanner: extractText + TOPIC_TO_SECTIONS + coverage thresholds"

key-files:
  created:
    - src/lib/editor/extensions.ts
    - src/lib/editor/compliance-gap-mark.ts
    - src/lib/editor/compliance-scanner.ts
  modified:
    - tests/editor/extensions.test.ts
    - tests/editor/compliance-gap-mark.test.ts
    - tests/editor/compliance-scanner.test.ts

key-decisions:
  - "TOPIC_TO_SECTIONS mapping: Technical topic applies to both Executive Summary and Technical Approach; Other applies to same two sections"
  - "stripComplianceMarks deletes marks array entirely when empty after filtering (avoids empty arrays in JSON)"
  - "Keyword threshold: 60%+ = addressed, 30-59% = partial, <30% = unaddressed; only 4+ letter words counted"

patterns-established:
  - "ComplianceGapMark uses span[data-compliance-gap] parseHTML selector and class=compliance-gap renderHTML"
  - "Compliance scanner keyword extraction: /\\b[a-z]{4,}\\b/ regex on lowercased requirement text"

requirements-completed: [EDITOR-01, EDITOR-03, EDITOR-04]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 4 Plan 03: Tiptap Extension Array, ComplianceGap Mark, and Compliance Scanner Summary

**Custom Tiptap Mark extension (ComplianceGapMark) with span rendering, editorExtensions array for StarterKit/Underline/Table suite, and pure scanCompliance function with 60%/30% keyword coverage thresholds**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T23:30:55Z
- **Completed:** 2026-03-23T23:35:57Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `src/lib/editor/compliance-gap-mark.ts`: ComplianceGapMark Tiptap Mark extension with `requirementId` attribute, `span[data-compliance-gap]` HTML parsing/rendering, and `stripComplianceMarks` recursive JSON utility
- Created `src/lib/editor/extensions.ts`: `editorExtensions` array with 7 entries — StarterKit (h1-h3), Underline, Table, TableRow, TableHeader, TableCell, ComplianceGapMark
- Created `src/lib/editor/compliance-scanner.ts`: `extractText` + `scanCompliance` pure functions with topic-to-section mapping and 60%/30% keyword coverage thresholds
- Replaced 16 `it.todo` stubs with real passing assertions across 3 test files

## Task Commits

Each task was committed atomically using TDD (RED then GREEN commits):

1. **Task 1 RED: Test stubs for extensions and compliance-gap-mark** - `8900f25` (test)
2. **Task 1 GREEN: Implement extension array and ComplianceGap mark** - `25d922b` (feat)
3. **Task 2 RED: Test stubs for compliance scanner** - `29ad695` (test)
4. **Task 2 GREEN: Implement compliance scanner** - `533f9a4` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks have separate RED and GREEN commits per plan spec._

## Files Created/Modified

- `src/lib/editor/compliance-gap-mark.ts` - ComplianceGapMark Tiptap Mark extension + stripComplianceMarks recursive JSON utility
- `src/lib/editor/extensions.ts` - editorExtensions array: 7 Tiptap extensions configured
- `src/lib/editor/compliance-scanner.ts` - extractText (recursive Tiptap JSON) + scanCompliance (keyword coverage) pure functions
- `tests/editor/extensions.test.ts` - 5 real assertions: StarterKit, Underline, Table suite, ComplianceGapMark, heading levels
- `tests/editor/compliance-gap-mark.test.ts` - 6 real assertions: name, requirementId attr, parseHTML, strip removes complianceGap, preserves bold/italic, no-marks case
- `tests/editor/compliance-scanner.test.ts` - 6 real assertions: extractText, addressed/partial/unaddressed coverage, section filtering, empty doc

## Decisions Made

- `TOPIC_TO_SECTIONS` maps `'Other'` to `['Executive Summary', 'Technical Approach']` — catch-all for uncategorized requirements that could apply to general sections
- `stripComplianceMarks` deletes the `marks` key when the filtered array is empty — avoids `marks: []` in stored JSON which Tiptap renders identically but is cleaner
- Keyword threshold test uses 3 of 8 keywords (38%) for the partial test case — "construction management services" from a requirement with contractor/shall/provide/construction/management/services/federal/buildings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed partial coverage test fixture keyword count**
- **Found during:** Task 2 (compliance-scanner.test.ts GREEN phase)
- **Issue:** Test used "construction services" (2 of 8 keywords = 25%) which falls below 30% threshold — would be `unaddressed` not `partial`
- **Fix:** Changed test document text to "construction management services" (3 of 8 = 38%) — within the 30-59% partial range
- **Files modified:** tests/editor/compliance-scanner.test.ts
- **Verification:** Test passes with `partial` result; threshold math confirmed manually
- **Committed in:** 533f9a4 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test fixture keyword coverage math)
**Impact on plan:** Minor fix — test fixture used wrong keyword count for threshold boundary. No scope creep.

## Issues Encountered

- `tests/drafting/draft-route.test.ts` was discovered to fail after plan 04-02 created `draft-prompts.ts` (making the import resolve, surfacing a hoisting bug in the test). This is a pre-existing issue introduced by parallel plan 04-02, outside scope of 04-03. Logged for deferred resolution.

## Known Stubs

None — all stubs in this plan's test files (extensions.test.ts, compliance-gap-mark.test.ts, compliance-scanner.test.ts) were replaced with real assertions. 0 `it.todo` remaining in these files.

## Next Phase Readiness

- `editorExtensions` importable for Plan 04-04 Tiptap editor component setup
- `ComplianceGapMark` ready to be applied programmatically after auto-save in Plan 04-04
- `stripComplianceMarks` available for Plan 04-05 export pipeline
- `scanCompliance` ready for Plan 04-04 compliance panel live coverage display
- 17 tests passing across 3 editor files (11 Task 1 + 6 Task 2)

---
*Phase: 04-proposal-drafting-editor*
*Completed: 2026-03-23*
