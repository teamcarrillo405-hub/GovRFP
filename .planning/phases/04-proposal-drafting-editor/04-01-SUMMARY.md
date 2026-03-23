---
phase: 04-proposal-drafting-editor
plan: 01
subsystem: database
tags: [tiptap, anthropic, postgres, vitest, typescript, rls, migration]

# Dependency graph
requires:
  - phase: 03-rfp-analysis
    provides: AnalysisRequirement, ComplianceMatrixRow types used in compliance scanner stubs
  - phase: 01-foundation
    provides: proposals table that proposal_sections FK-references
provides:
  - 8 Tiptap v2 packages at 2.27.2 installed as production deps
  - @anthropic-ai/sdk promoted to production dependency for Next.js route handler
  - proposal_sections DB migration with RLS, unique constraint, check constraints
  - src/lib/editor/types.ts: ProposalSection, SectionName, SECTION_NAMES, DraftStatus, DraftRequest, SaveSectionRequest, ComplianceCoverage
  - 7 test stub files covering DRAFT-01..06 and EDITOR-01..04 (33 it.todo stubs)
affects:
  - 04-02: editor component implementation (imports from src/lib/editor/types.ts)
  - 04-03: draft route handler (imports types, uses proposal_sections table)
  - 04-04: compliance live-link (imports ComplianceCoverage, uses compliance scanner)
  - 04-05: export pipeline (reads proposal_sections content jsonb)

# Tech tracking
tech-stack:
  added:
    - "@tiptap/react@2.27.2"
    - "@tiptap/starter-kit@2.27.2"
    - "@tiptap/extension-underline@2.27.2"
    - "@tiptap/extension-table@2.27.2"
    - "@tiptap/extension-table-row@2.27.2"
    - "@tiptap/extension-table-header@2.27.2"
    - "@tiptap/extension-table-cell@2.27.2"
    - "@tiptap/pm@2.27.2"
    - "@anthropic-ai/sdk@0.80.0 (moved to production)"
  patterns:
    - "Migration-as-source-of-truth: schema tests read SQL file directly to assert structure"
    - "it.todo() stubs establish RED baseline for TDD RED-GREEN in later plans"

key-files:
  created:
    - supabase/migrations/00004_proposal_sections.sql
    - src/lib/editor/types.ts
    - tests/editor/proposal-sections-schema.test.ts
    - tests/editor/extensions.test.ts
    - tests/editor/auto-save.test.ts
    - tests/editor/compliance-scanner.test.ts
    - tests/editor/compliance-gap-mark.test.ts
    - tests/drafting/draft-prompts.test.ts
    - tests/drafting/draft-route.test.ts
  modified:
    - package.json
    - package-lock.json
    - .env.local.example

key-decisions:
  - "@anthropic-ai/sdk promoted to production dependency — Phase 4 draft generation runs from Next.js App Router route handler, not Edge Function"
  - "ANTHROPIC_API_KEY now required in both Supabase Edge Function secrets AND .env.local for Phase 4+"
  - "content jsonb default stores empty Tiptap document structure as JSON — avoids null checks in editor"

patterns-established:
  - "Test assertion whitespace: migration SQL uses padded column definitions — tests must match exact spacing (content         jsonb not content jsonb)"

requirements-completed: [DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06, EDITOR-01, EDITOR-02, EDITOR-03, EDITOR-04]

# Metrics
duration: 12min
completed: 2026-03-23
---

# Phase 4 Plan 01: Phase 4 Foundation — Dependencies, Migration, Types, Test Stubs Summary

**8 Tiptap v2 packages installed at 2.27.2, proposal_sections DB table with RLS and check constraints, shared TypeScript types, and 7 test stub files scaffolding all Phase 4 TDD coverage**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-23T16:23:00Z
- **Completed:** 2026-03-23T16:36:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Installed 8 Tiptap v2 packages all pinned to 2.27.2, promoted `@anthropic-ai/sdk` to production dependency
- Created `supabase/migrations/00004_proposal_sections.sql` — table with RLS policy, `unique(proposal_id, section_name)`, check constraints on `section_name` and `draft_status`, auto-updated_at trigger
- Created `src/lib/editor/types.ts` exporting ProposalSection, SectionName, SECTION_NAMES, DraftStatus, DraftRequest, SaveSectionRequest, ComplianceCoverage
- Scaffolded 7 test stub files (33 `it.todo` stubs) covering all 10 requirement IDs (DRAFT-01..06, EDITOR-01..04); full suite now 210 passing + 33 todo

## Task Commits

Each task was committed atomically:

1. **Task 1: Install packages, move Anthropic SDK, update env docs** - `5ca31d3` (chore)
2. **Task 2: Create DB migration, shared types, and all test stubs** - `08a6cc5` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `package.json` - Added 8 Tiptap packages to dependencies, moved @anthropic-ai/sdk from devDependencies to dependencies
- `package-lock.json` - Updated lockfile
- `.env.local.example` - Added ANTHROPIC_API_KEY for Next.js route handler
- `supabase/migrations/00004_proposal_sections.sql` - proposal_sections table with RLS, unique + check constraints
- `src/lib/editor/types.ts` - ProposalSection, SectionName, SECTION_NAMES, DraftStatus, DraftRequest, SaveSectionRequest, ComplianceCoverage
- `tests/editor/proposal-sections-schema.test.ts` - 6 structural migration assertions (not stubs — these verify SQL)
- `tests/editor/extensions.test.ts` - 5 it.todo stubs for EDITOR-01/04
- `tests/editor/auto-save.test.ts` - 4 it.todo stubs for EDITOR-02
- `tests/editor/compliance-scanner.test.ts` - 5 it.todo stubs for EDITOR-03
- `tests/editor/compliance-gap-mark.test.ts` - 6 it.todo stubs for EDITOR-04
- `tests/drafting/draft-prompts.test.ts` - 8 it.todo stubs for DRAFT-01..06
- `tests/drafting/draft-route.test.ts` - 5 it.todo stubs for draft route handler

## Decisions Made

- `@anthropic-ai/sdk` promoted to production dependency: Phase 4 draft generation runs from a Next.js App Router route handler (server-side, but not an Edge Function). The SDK must be available in the production bundle.
- `ANTHROPIC_API_KEY` now documented in `.env.local.example` — Phase 3 used it only as an Edge Function secret. Phase 4+ requires it in both places.
- `content jsonb` default stores `'{"type":"doc","content":[]}'` — the canonical empty Tiptap document prevents null checks in the editor; the editor always loads with a valid document tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertion for padded SQL column definition**
- **Found during:** Task 2 (proposal-sections-schema.test.ts)
- **Issue:** Plan specified `expect(migration).toContain('content jsonb')` but the migration SQL uses column padding: `content         jsonb` — assertion was failing
- **Fix:** Updated test assertion to match exact SQL whitespace: `'content         jsonb'`
- **Files modified:** tests/editor/proposal-sections-schema.test.ts
- **Verification:** Test passes; 6/6 migration schema assertions green
- **Committed in:** 08a6cc5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test assertion whitespace)
**Impact on plan:** Minor fix — test assertion matched actual SQL formatting. No scope creep.

## Issues Encountered

None beyond the test assertion whitespace fix above.

## Known Stubs

The following stubs are intentional — they are `it.todo()` skeletons scaffolded for TDD RED-GREEN in Plans 02-05:

- `tests/drafting/draft-prompts.test.ts` — 8 stubs (buildSectionPrompt): Plan 02 implements
- `tests/drafting/draft-route.test.ts` — 5 stubs (POST /api/proposals/[id]/draft): Plan 02 implements
- `tests/editor/extensions.test.ts` — 5 stubs (editorExtensions): Plan 03 implements
- `tests/editor/auto-save.test.ts` — 4 stubs (auto-save): Plan 03 implements
- `tests/editor/compliance-scanner.test.ts` — 5 stubs (scanCompliance): Plan 04 implements
- `tests/editor/compliance-gap-mark.test.ts` — 6 stubs (ComplianceGapMark, stripComplianceMarks): Plan 04 implements

These stubs do NOT prevent Plan 01's goal. Plan 01's goal is scaffolding — stubs are the deliverable.

## Next Phase Readiness

- Tiptap packages installed — Plan 02 can import @tiptap/react, @tiptap/starter-kit, extensions immediately
- `src/lib/editor/types.ts` importable — all subsequent plans reference ProposalSection, SectionName
- `proposal_sections` migration SQL ready to apply — run before Phase 4 goes live
- 7 test stubs provide TDD RED baseline for Plans 02-05

---
*Phase: 04-proposal-drafting-editor*
*Completed: 2026-03-23*
