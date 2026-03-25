# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-24
**Phases:** 5 | **Plans:** 22 | **Sessions:** 2 (founding session 2026-03-23, execution session 2026-03-24)

### What Was Built

- **Full RFP → proposal pipeline** — upload PDF/DOCX, async OCR parse, Claude structured extraction, compliance matrix + win score, AI-streamed draft sections in Tiptap editor, Word + PDF export
- **Production-grade auth and billing** — Supabase PKCE email verification, Stripe 14-day no-card trial with all 6 webhook events, subscription gating throughout
- **6,025 LOC TypeScript in 3 days** — 202 files, 180 tests, zero regressions across 5 phases

### What Worked

- **Wave-based parallel execution** — running 05-02 and 05-03 (docx + PDF converters) in parallel saved meaningful wall time; no file overlap means zero merge conflicts
- **RESEARCH.md before planning** — catching `serverExternalPackages` + `runtime = 'nodejs'` requirements for `@react-pdf/renderer` in research phase (not discovery-by-failure) saved a debugging cycle
- **Tiptap buffer pattern** — calling `setContent()` once on stream completion (not per chunk) was the right call; eliminates cursor jump during generation
- **Claude prompt caching on RFP text** — `cache_control: ephemeral` on the rfp_text block cuts analysis cost ~47% on calls 2+3; documented as MUST-DO from day one

### What Was Inefficient

- **Wrong project directory at session start** — began planning Phase 4 against `prevailing-wage` instead of `hcc-proposal-ai`; cost ~10 minutes to identify. Fix: check project root before spawning any planner
- **Worktree `npm install` isolation** — packages installed in worktree don't carry back to main project on merge; needed a manual `npm install` after Wave 0 merge. Fix: document this as a post-merge step whenever packages are added
- **Vitest scanning worktree directories** — stale `.claude/worktrees/` directories contained `tests/` copies that vitest picked up, causing false failures. Fixed by adding `exclude: ['**/.claude/worktrees/**']` to `vitest.config.ts`
- **UI-SPEC spacing gate (p-1.5)** — needed 2 iterations because `p-1.5` (6px) isn't on the 4px grid. Small fix but required a full re-verify cycle. Fix: check all spacing values against the 4px grid before first submission

### Patterns Established

- **`await params` everywhere** — Next.js 16 requires async params in all route handlers and page components; baked into every plan's acceptance criteria
- **`getUser()` not `getSession()` server-side** — cached pattern `(select auth.uid()) = user_id` in all RLS policies
- **`stripComplianceMarks()` before export** — always strip before conversion; never export `complianceGap` marks to documents
- **SSE streaming with buffer** — accumulate `StreamingTextResponse` chunks in a `let buffer = ''`, call `setContent()` once on `done: true`

### Key Lessons

1. **Research.md prevents discovery-by-failure** — every critical integration detail (Textract vs Tesseract, serverExternalPackages, Packer.toBuffer wrapping, 8(a) regex boundary) was caught in research, not at test time
2. **Worktrees need post-merge `npm install`** — packages installed inside an isolated worktree don't auto-install in the main workspace after merge; always run `npm install` after merging a plan that modifies `package.json`
3. **Vitest needs worktree exclusion** — add `exclude: ['**/.claude/worktrees/**']` to any project using GSD parallel agents
4. **Phase 5 is the easiest phase** — export is purely functional (no new DB, no auth complexity); the hard work is always Phase 2-3 (infra + AI)

### Cost Observations

- Model mix: ~30% opus (planning), ~70% sonnet (execution + verification)
- Sessions: 2 sessions over 3 days
- Notable: Parallel Wave 1 execution (docx + PDF) cut wall time roughly in half with zero merge conflicts — ideal split when files don't overlap

---

## Milestone: v1.1 — RFP Structure Sidebar

**Shipped:** 2026-03-25
**Phases:** 1 (Phase 6) | **Plans:** 2 | **Sessions:** 2

### What Was Built

- **Collapsible RFP Structure sidebar** — reads `rfp_structure` JSONB already in DB; zero new API calls or schema changes
- **Bidirectional navigation** — click sidebar section → editor scrolls to heading; cursor moves in editor → sidebar highlights active section
- **Full E2E test suite (35 tests)** — global-setup with storageState, SeedClient for DB seeding, two Playwright projects (fast/pipeline), 32/32 passing in ~42s
- **Tab overflow fix** — `overflow-x-auto scrollbar-none` prevents Price Narrative tab from being hidden when sidebar is expanded

### What Worked

- **Frontend-only phase** — no new DB schema, no new packages, no Edge Functions; pure component work on top of Phase 4 editor infrastructure shipped in 2 days
- **Pre-wired props interface** — Plan 01 implemented Plan 02's `activeRfpSection` + `onSectionClick` props proactively; Plan 02 was essentially already done when it ran
- **SeedClient pattern** — inserting known-good DB state (seeded analyzed proposal) before E2E tests made browser tests fast and deterministic without a real upload/analysis cycle

### What Was Inefficient

- **E2E tests discovered selector mismatches** — 4 of 32 tests failed on first run due to wrong button text (`Browse files` not `upload`), missing nav element, and strict mode violation; required a fix pass. Fix: check actual UI component text before writing selectors
- **Playground testing needed a real RFP with section headings** — the sidebar's click-to-scroll only activates with parseable headings; the demo RFP had "No structure found". Not a bug but a gap between UAT expectation and real-world data

### Patterns Established

- **`scrollbar-none` CSS utility** — added to `globals.css` for any overflowing flex row (tab bars, horizontal nav)
- **Playwright two-project split** — `fast` (smoke, ~42s) and `pipeline` (upload + AI generation, ~3min) as separate projects allows CI to run smoke tests on every PR
- **`storageState` + `SeedClient` pattern** — global-setup saves auth once; `beforeAll`/`afterAll` seed/teardown per describe block; no test logs in every time

### Key Lessons

1. **Check actual component text before writing E2E selectors** — reading the component file takes 30 seconds and prevents 4 failing tests
2. **Frontend-only milestones ship faster** — Phase 6 (1 phase, 2 plans, 2 days) vs v1.0 (5 phases, 22 plans, 3 days); no infra/auth complexity compounds
3. **Proactive prop wiring across plans** — when Plan 01 implements Plan 02's interface upfront, Plan 02 becomes a verify + wire pass rather than a build pass

### Cost Observations

- Model mix: ~20% opus (planning), ~80% sonnet (execution)
- Sessions: 2 sessions (planning session 2026-03-24, execution + E2E session 2026-03-25)
- Notable: Single frontend phase with no DB work = minimal back-and-forth with external services

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 2 | 5 | First milestone — baseline established |
| v1.1 Sidebar | 2 | 1 | Frontend-only milestone; E2E test suite added |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 | 180 | 0 (all deps intentional) |
| v1.1 | 35 E2E (32 passing) | 0 |

### Top Lessons (Verified Across Milestones)

1. **Research.md prevents discovery-by-failure** — confirmed across both milestones; every critical detail caught in research phase
2. **Read component files before writing E2E selectors** — confirmed v1.1; saves a full fix pass
