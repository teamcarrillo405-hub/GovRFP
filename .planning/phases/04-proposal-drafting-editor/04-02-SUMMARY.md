---
phase: 04-proposal-drafting-editor
plan: 02
subsystem: api
tags: [claude-api, streaming, supabase, tdd, typescript, api-routes, prompt-engineering]

# Dependency graph
requires:
  - phase: 04-01
    provides: src/lib/editor/types.ts (SectionName, SECTION_NAMES, DraftRequest, ProposalSection, DraftStatus)
  - phase: 03-rfp-analysis
    provides: AnalysisRequirement interface for requirement filtering
  - phase: 01-foundation
    provides: checkSubscription, isSubscriptionActive, createClient, getUser
provides:
  - src/lib/editor/draft-prompts.ts: buildSectionPrompt() — all 5 section prompt builders with profile injection
  - src/app/api/proposals/[id]/draft/route.ts: POST streaming route with auth + subscription gating
  - src/app/api/proposals/[id]/sections/route.ts: GET (load all) + PATCH (upsert) sections CRUD
affects:
  - 04-03: editor component uses GET /sections to load saved content
  - 04-04: compliance live-link triggered after draft generation completes
  - 04-05: export reads from proposal_sections populated by PATCH /sections

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN: wrote failing tests first, confirmed failure, then implemented"
    - "vi.mock factory pattern: use class MockX for SDK constructors, avoid outer-scope variable references (hoisting)"
    - "Chainable mock pattern: all intermediate Supabase methods return chain via mockReturnValue(chain)"
    - "cache_control ephemeral on RFP text block only (instruction block changes per call)"
    - "Promise.all for parallel Supabase data fetches in route handler"

key-files:
  created:
    - src/lib/editor/draft-prompts.ts
    - src/app/api/proposals/[id]/draft/route.ts
    - src/app/api/proposals/[id]/sections/route.ts
  modified:
    - tests/drafting/draft-prompts.test.ts
    - tests/drafting/draft-route.test.ts

key-decisions:
  - "cache_control ephemeral on rfp_text system block only — instruction block changes per call so cannot be cached"
  - "Promise.all for 5 parallel Supabase fetches (profile, past_projects, key_personnel, proposals, rfp_analysis) — minimizes latency before stream starts"
  - "Sections route uses NextResponse.json for GET/PATCH, draft route uses raw Response for SSE stream"
  - "vi.mock with class constructor pattern for Anthropic SDK — arrow function factories fail new keyword"

requirements-completed: [DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06]

# Metrics
duration: 9min
completed: 2026-03-23
---

# Phase 4 Plan 02: Claude Streaming Draft API + Section Prompt Builders Summary

**5 section prompt builders with profile injection, a streaming SSE draft route with auth/subscription gating, and a sections CRUD route — the AI backbone of the proposal editor**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-23T23:30:16Z
- **Completed:** 2026-03-23T23:38:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Built `buildSectionPrompt()` in `src/lib/editor/draft-prompts.ts` with all 5 section templates:
  - Executive Summary: injects company_name, certifications, capability_statement, key personnel, top 5 past projects
  - Technical Approach: filters requirements by `proposal_topic === 'Technical'`, injects relevant projects and personnel
  - Management Plan: injects all key personnel with name, title, experience (up to 200 chars each)
  - Past Performance: injects up to 5 past projects with agency, scope, contract_value, period, outcome
  - Price Narrative: explicitly forbids dollar amounts ("Do NOT include any specific dollar amounts")
- RFP text block has `cache_control: { type: 'ephemeral' }` for Anthropic prompt caching (47% cost savings)
- Optional instruction parameter appended as "Special instruction: ..." when provided
- POST `/api/proposals/[id]/draft`: auth (401), subscription (402), section validation (400), SSE stream response
- GET `/api/proposals/[id]/sections`: returns all proposal sections for authenticated user
- PATCH `/api/proposals/[id]/sections`: upserts section with `onConflict: 'proposal_id,section_name'` and `last_saved_at`
- All routes use `await params` (Next.js 16 pattern)
- 18 tests passing (9 prompt tests + 9 route tests), full suite 359 passing

## Task Commits

1. **Task 1: Build per-section prompt builders with profile injection** - `500f333` (feat)
2. **Task 2: Build draft streaming route + sections CRUD route** - `88748fd` (feat)

## Files Created/Modified

- `src/lib/editor/draft-prompts.ts` — buildSectionPrompt() with 5 section templates, cache_control, instruction support
- `src/app/api/proposals/[id]/draft/route.ts` — POST: auth + subscription + validation + Anthropic SSE stream
- `src/app/api/proposals/[id]/sections/route.ts` — GET: load all + PATCH: upsert with last_saved_at
- `tests/drafting/draft-prompts.test.ts` — 9 real assertions replacing 8 it.todo stubs
- `tests/drafting/draft-route.test.ts` — 9 real assertions (POST 401/402/400/200/instruction + GET 401/200 + PATCH 401/200)

## Decisions Made

- `cache_control` ephemeral only on the RFP text system block — the instructions block changes per-call (section name, profile data, instruction) so cannot be cached. Mirrors Phase 3 decision.
- `Promise.all` for 5 parallel Supabase fetches before streaming — profile, past_projects, key_personnel, proposals, rfp_analysis all fetched concurrently to minimize pre-stream latency.
- Anthropic SDK mock in tests must use a class constructor, not a factory arrow function — `vi.mock` with `class MockAnthropic` satisfies `new Anthropic()` call in route handler.
- Chainable mock pattern for Supabase: build a single chain object where chaining methods (select, eq, order, upsert) return the chain itself; terminal methods (single, limit) resolve with data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting — outer-scope variable reference in factory**
- **Found during:** Task 2 (draft-route.test.ts TDD RED → implementation)
- **Issue:** Original test stub used `const mockGetUser = vi.fn()` before `vi.mock()` factory, but vitest hoists `vi.mock` calls to top of file — factory could not reference outer `let`/`const` declarations initialized below
- **Fix:** Moved mock setup entirely inside `vi.mock()` factory; exposed mocks as `__mockAuth`/`__mockFrom` module exports; accessed via typed module import in tests
- **Files modified:** tests/drafting/draft-route.test.ts
- **Commit:** 88748fd

**2. [Rule 1 - Bug] Fixed Anthropic mock — arrow function factory cannot be used with `new`**
- **Found during:** Task 2 (GREEN phase — route tests failing with "is not a constructor")
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` returns a plain function — `new Anthropic()` in route.ts throws TypeError
- **Fix:** Changed mock to use `class MockAnthropic { messages = { stream: mockStream } }` inside factory
- **Files modified:** tests/drafting/draft-route.test.ts
- **Commit:** 88748fd

**3. [Rule 1 - Bug] Fixed Supabase chain mock — `.order().limit()` was not chainable**
- **Found during:** Task 2 (GREEN phase — POST success tests failing)
- **Issue:** `order: vi.fn().mockResolvedValue({...})` returns a Promise, not a chain — calling `.limit()` on it throws TypeError
- **Fix:** Created `makeChain()` helper where chaining methods return `chain` object; only terminal methods (`single`, `limit`) resolve with values
- **Files modified:** tests/drafting/draft-route.test.ts
- **Commit:** 88748fd

## Known Stubs

None — all implementation files contain production-ready code with no placeholder stubs.

## Next Phase Readiness

- `buildSectionPrompt` importable by any component or route needing AI section drafts
- Draft route ready for Tiptap editor to call (Plan 03 — streaming injection into editor)
- Sections route ready for auto-save and initial load in ProposalEditor component (Plan 03)
- 29 it.todo stubs remain in editor/compliance test files for Plans 03-05

---
*Phase: 04-proposal-drafting-editor*
*Completed: 2026-03-23*
