---
phase: 03-rfp-analysis
plan: 01
subsystem: database
tags: [postgres, jsonb, supabase, typescript, anthropic, vitest]

# Dependency graph
requires:
  - phase: 02-wage-data-infrastructure
    provides: "document_jobs table + claim_next_document_job() function"
  - phase: 01-foundation
    provides: "proposals table + auth.users FK"
provides:
  - "rfp_analysis table with JSONB columns, RLS, and GIN indexes"
  - "job_type column on document_jobs with check constraint (document|analysis)"
  - "claim_next_job(p_job_type) generic function + claim_next_document_job() backward-compat alias"
  - "proposals.status constraint expanded to include analyzed and failed"
  - "TypeScript interfaces for all Phase 3 output types"
  - "5 test stub files in tests/analysis/ with it.todo placeholders"
affects: [03-02, 03-03, 03-04, analyze-proposal]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk@0.80.0 (devDependency — types only)"]
  patterns:
    - "AnalysisRequirement renamed from RfpRequirement to avoid Phase 2 interface collision"
    - "Migration-reading tests: readFileSync assertions against SQL migration files"
    - "claim_next_job(p_job_type) polymorphic pattern for multi-type job queues"

key-files:
  created:
    - supabase/migrations/00003_rfp_analysis.sql
    - src/lib/analysis/types.ts
    - tests/analysis/set-aside-detector.test.ts
    - tests/analysis/win-score.test.ts
    - tests/analysis/section-lm-detector.test.ts
    - tests/analysis/analysis-job-queue.test.ts
    - tests/analysis/rfp-analysis-schema.test.ts
  modified:
    - package.json
    - package-lock.json
    - .env.local.example

key-decisions:
  - "AnalysisRequirement (not RfpRequirement) to avoid Phase 2 rfp-structure.ts interface collision"
  - "analysis-job-queue.test.ts and rfp-analysis-schema.test.ts use real readFileSync assertions (not it.todo) because migration SQL already exists and tests provide immediate regression coverage"
  - "claim_next_document_job() retained as full backward-compat alias -- delegates to claim_next_job('document')"
  - "ANTHROPIC_API_KEY excluded from .env.local -- lives in Supabase Edge Function secrets only"

patterns-established:
  - "Pattern 1: Job queue polymorphism via p_job_type parameter -- add new job types without new tables"
  - "Pattern 2: Migration structural tests via readFileSync -- cheap, fast, catches SQL regressions pre-deploy"

requirements-completed: [ANALYZE-01, ANALYZE-02, ANALYZE-03, ANALYZE-04, ANALYZE-05]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 3 Plan 01: RFP Analysis Wave 0 Summary

**Postgres rfp_analysis table with JSONB/GIN for structured AI output, polymorphic job queue via claim_next_job(p_job_type), and TypeScript interfaces for all 5 analysis data contracts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T19:19:40Z
- **Completed:** 2026-03-23T19:27:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created `rfp_analysis` table with all JSONB columns, RLS, GIN indexes on requirements and compliance_matrix
- Extended `document_jobs` with `job_type` column; added `claim_next_job(p_job_type)` with `claim_next_document_job()` backward-compat alias
- Updated `proposals.status` constraint to include `analyzed` and `failed`
- Installed `@anthropic-ai/sdk@0.80.0` as devDependency (types only — never a Next.js runtime dep)
- Created `src/lib/analysis/types.ts` exporting 8 TypeScript interfaces + `WIN_SCORE_WEIGHTS`
- Scaffolded 5 test stub files in `tests/analysis/` — 2 with real passing assertions, 3 with it.todo stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + Anthropic SDK + .env example** - `a80f4d7` (feat)
2. **Task 2: TypeScript interfaces + 5 test stubs** - `68779d3` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `supabase/migrations/00003_rfp_analysis.sql` - rfp_analysis table, RLS, GIN indexes, job_type column, claim_next_job(), backward-compat alias, proposals.status constraint
- `src/lib/analysis/types.ts` - AnalysisRequirement, ComplianceMatrixRow, WinFactorDetail, WinFactors, SetAsideFlag, SectionLMEntry, RfpAnalysis, WIN_SCORE_WEIGHTS
- `tests/analysis/analysis-job-queue.test.ts` - 4 passing migration assertions
- `tests/analysis/rfp-analysis-schema.test.ts` - 4 passing migration assertions
- `tests/analysis/set-aside-detector.test.ts` - 9 it.todo stubs
- `tests/analysis/win-score.test.ts` - 9 it.todo stubs
- `tests/analysis/section-lm-detector.test.ts` - 6 it.todo stubs
- `package.json` - @anthropic-ai/sdk@0.80.0 in devDependencies
- `.env.local.example` - ANTHROPIC_API_KEY comment (Edge Function secret only)

## Decisions Made

- Named the requirement interface `AnalysisRequirement` (not `RfpRequirement`) to avoid collision with Phase 2's `RfpRequirement` from `rfp-structure.ts`, which has a different shape (3 fields vs 7 fields)
- Used real `readFileSync` assertions in `analysis-job-queue.test.ts` and `rfp-analysis-schema.test.ts` — since the migration file already exists, concrete tests provide immediate regression coverage rather than deferring to it.todo
- `claim_next_document_job()` fully retained as a delegating alias — Phase 2 Edge Function (`process-documents`) calls this name and must not break

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before Phase 3 works in production:
1. Set Supabase Edge Function secret: `ANTHROPIC_API_KEY=sk-ant-...` (via Supabase Dashboard > Edge Functions > Secrets)
2. Add second pg_cron job: `* * * * *` calling `analyze-proposal` Edge Function
3. Run migration `00003_rfp_analysis.sql` against production Supabase instance

## Next Phase Readiness

- Wave 0 complete: all data contracts and schema defined
- `03-02-PLAN.md` (Wave 1): set-aside-detector, section-lm-detector, win-score utility library — all stubs are ready
- `03-03-PLAN.md` (Wave 1 parallel): analyze-proposal Edge Function — types file is ready
- TypeScript: `tsc --noEmit` passes cleanly
- Tests: 8 passing (migration assertions) + 24 todo + 0 failures

---
*Phase: 03-rfp-analysis*
*Completed: 2026-03-23*

## Self-Check: PASSED

- supabase/migrations/00003_rfp_analysis.sql — FOUND
- src/lib/analysis/types.ts — FOUND
- tests/analysis/set-aside-detector.test.ts — FOUND
- tests/analysis/win-score.test.ts — FOUND
- tests/analysis/section-lm-detector.test.ts — FOUND
- tests/analysis/analysis-job-queue.test.ts — FOUND
- tests/analysis/rfp-analysis-schema.test.ts — FOUND
- Commit a80f4d7 — FOUND
- Commit 68779d3 — FOUND
- All 7 acceptance criteria — PASS
