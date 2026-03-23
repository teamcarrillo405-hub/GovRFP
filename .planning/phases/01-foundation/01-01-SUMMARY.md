---
phase: 01-foundation
plan: 01
subsystem: scaffold
tags: [nextjs, supabase, stripe, postgres, rls, testing]
dependency_graph:
  requires: []
  provides: [next-app, supabase-clients, stripe-client, db-schema, test-infra]
  affects: [01-02, 01-03, 01-04, 01-05]
tech_stack:
  added:
    - next@16.2.1
    - react@19.2.4
    - "@supabase/ssr@0.9.0"
    - "@supabase/supabase-js@2.100.0"
    - stripe@20.4.1
    - "@stripe/stripe-js@8.11.0"
    - zod@4.3.6
    - "@tanstack/react-query@5.95.2"
    - vitest@4.1.1
    - "@playwright/test@1.58.2"
    - "@vitejs/plugin-react@6.0.1"
    - dotenv@17.3.1
  patterns:
    - SSR Supabase client with async cookies() for Next.js 16
    - "(select auth.uid()) caching pattern in RLS policies"
    - bigint cents for contract_value (avoids float rounding)
    - handle_new_user() trigger auto-creates profile with 14-day trial
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - .env.local.example
    - .gitignore
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/admin.ts
    - src/lib/stripe/server.ts
    - supabase/migrations/00001_foundation_schema.sql
    - vitest.config.ts
    - playwright.config.ts
    - tests/setup.ts
    - tests/auth/confirm.test.ts
    - tests/rls/cross-user-isolation.test.ts
    - tests/billing/trial-checkout.test.ts
    - tests/billing/access-gate.test.ts
    - tests/profile/profile-crud.test.ts
    - tests/profile/capability-statement.test.ts
  modified: []
decisions:
  - "Used @supabase/ssr (not deprecated @supabase/auth-helpers-nextjs) for Next.js 16 App Router cookie-based sessions"
  - "Installed dotenv as dev dependency for tests/setup.ts (not bundled with Next.js)"
  - "Added !.env.local.example exception to .gitignore so the template is tracked in git"
  - "Moved .planning/ and .git/ temporarily during create-next-app bootstrap to avoid non-empty-directory error"
metrics:
  duration: "9 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 23
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**One-liner:** Next.js 16.2.1 app bootstrapped with @supabase/ssr, Stripe, Zod, full Postgres schema with RLS and auto-profile trigger, Vitest + Playwright test infrastructure green.

## What Was Built

A fully runnable Next.js 16 application scaffold with all Phase 1 dependencies installed. The Supabase database schema defines four tables (profiles, past_projects, key_personnel, proposals) with per-user Row Level Security using the `(select auth.uid())` caching pattern. A `handle_new_user()` trigger automatically creates a profiles row with `trial_ends_at = now() + 14 days` on every Supabase Auth user signup. Server, browser, and admin Supabase client factories are in place along with a Stripe singleton. All six VALIDATION.md Wave 0 test stubs are registered in Vitest.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Bootstrap Next.js 16 + install dependencies | 4e2d274 | package.json, .env.local.example, next.config.ts, globals.css |
| 2 | Supabase/Stripe clients, schema migration, test infra | c76bcb4 | src/lib/supabase/*.ts, src/lib/stripe/server.ts, supabase/migrations/00001, vitest.config.ts, tests/ |

## Verification Results

- `npm run build`: SUCCESS — Next.js 16.2.1 Turbopack build compiles with no errors
- `npx vitest run`: 6 todo tests (all test stubs recognized, exit 0)
- `supabase/migrations/00001_foundation_schema.sql`: 4 tables + RLS + trigger + indexes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] Added dotenv to devDependencies**
- **Found during:** Task 2 — tests/setup.ts uses `import { config } from 'dotenv'`
- **Issue:** dotenv is not included in Next.js 16 default dependencies; test setup would fail at runtime
- **Fix:** `npm install -D dotenv`
- **Files modified:** package.json
- **Commit:** c76bcb4

**2. [Rule 1 - Config] Added .env.local.example exception to .gitignore**
- **Found during:** Task 1 — `git add .env.local.example` failed because `.env*` pattern in generated .gitignore blocked it
- **Issue:** The plan specifies `.env.local.example` must be committed for documentation; default Next.js .gitignore ignores all .env* files
- **Fix:** Added `!.env.local.example` exception line to .gitignore
- **Files modified:** .gitignore
- **Commit:** 4e2d274

**3. [Rule 3 - Blocking] Moved .planning/ and .git/ temporarily for bootstrap**
- **Found during:** Task 1 — `create-next-app` refuses to write to a non-empty directory
- **Issue:** Project root already contained .planning/ and .git/ from GSD initialization
- **Fix:** Moved both to /tmp, ran bootstrap, moved back
- **Files modified:** None (operation was transient)

## Known Stubs

- `supabase/migrations/00001_foundation_schema.sql` — `proposals` table is a stub with only id/user_id/title/status; content columns (rfp_data, sections, compliance_matrix) will be added in Phase 4 Plan 01

This is intentional per the plan: the stub exists for Phase 1 RLS testing only.

## Self-Check: PASSED

Files verified to exist:
- src/lib/supabase/server.ts: FOUND
- src/lib/supabase/client.ts: FOUND
- src/lib/supabase/admin.ts: FOUND
- src/lib/stripe/server.ts: FOUND
- supabase/migrations/00001_foundation_schema.sql: FOUND
- vitest.config.ts: FOUND
- playwright.config.ts: FOUND
- tests/setup.ts: FOUND
- tests/auth/confirm.test.ts: FOUND
- tests/rls/cross-user-isolation.test.ts: FOUND
- tests/billing/trial-checkout.test.ts: FOUND
- tests/billing/access-gate.test.ts: FOUND
- tests/profile/profile-crud.test.ts: FOUND
- tests/profile/capability-statement.test.ts: FOUND

Commits verified:
- 4e2d274: FOUND (feat(01-01): bootstrap Next.js 16)
- c76bcb4: FOUND (feat(01-01): create Supabase/Stripe clients)
