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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 2 | 5 | First milestone — baseline established |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 | 180 | 0 (all deps intentional) |

### Top Lessons (Verified Across Milestones)

1. *Accumulating — check back after v2.0*
