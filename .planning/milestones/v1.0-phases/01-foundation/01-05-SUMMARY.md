---
phase: 01-foundation
plan: 05
subsystem: testing
tags: [tests, rls, billing, profile, auth, vitest]
dependency_graph:
  requires: ["01-02", "01-03", "01-04"]
  provides: ["verified-rls-policy-coverage", "verified-billing-gating", "verified-profile-validation", "verified-auth-confirm"]
  affects: ["01-VALIDATION.md test coverage"]
tech_stack:
  added: []
  patterns: ["migration-as-source-of-truth assertion testing", "Zod schema boundary testing", "file-read code-structure tests"]
key_files:
  created: []
  modified:
    - tests/rls/cross-user-isolation.test.ts
    - tests/billing/access-gate.test.ts
    - tests/billing/trial-checkout.test.ts
    - tests/profile/profile-crud.test.ts
    - tests/profile/capability-statement.test.ts
    - tests/auth/confirm.test.ts
decisions:
  - "Migration-as-source-of-truth: RLS tests read the SQL migration file directly to assert policy presence — avoids needing a running Supabase instance in CI"
  - "File-read code-structure tests: billing and auth tests read source files as strings to assert configuration constants — pattern works without mocking Next.js or Stripe"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 6
requirements_covered: [AUTH-05, BILLING-03, PROFILE-01, PROFILE-04, AUTH-02, BILLING-01]
---

# Phase 1 Plan 05: Test Suite Completion Summary

**One-liner:** Replaced all 6 VALIDATION.md Wave 0 test stubs with 34 real assertions covering RLS policies, subscription gating, profile/personnel/past-project validation, capability statement boundaries, auth confirm routing, and trial checkout config.

## What Was Built

All `test.todo` stubs in the Wave 0 test files were replaced with real, passing test implementations:

### Task 1: RLS + Billing Tests

**`tests/rls/cross-user-isolation.test.ts`** (8 tests)
- Verifies all 4 tables (profiles, past_projects, key_personnel, proposals) have `enable row level security`
- Verifies profiles SELECT policy uses `auth.uid() = id`
- Verifies profiles UPDATE policy has both `using` and `with check` clauses
- Verifies past_projects policy uses `auth.uid() = user_id`
- Verifies all tables reference `auth.users on delete cascade` (minimum 4 found)

**`tests/billing/access-gate.test.ts`** (5 tests)
- Verifies `isSubscriptionActive('trialing')` returns true
- Verifies `isSubscriptionActive('active')` returns true
- Verifies `isSubscriptionActive('past_due')` returns false
- Verifies `isSubscriptionActive('canceled')` returns false
- Verifies `isSubscriptionActive('none')` returns false

**`tests/billing/trial-checkout.test.ts`** (3 tests)
- Verifies checkout route contains `trial_period_days: 14`
- Verifies checkout route contains `payment_method_collection: 'if_required'`
- Verifies checkout route contains `missing_payment_method: 'cancel'`

### Task 2: Profile + Auth Tests

**`tests/profile/profile-crud.test.ts`** (10 tests)
- PROFILE-01: 6 tests covering company_name required, NAICS 6-digit enforcement, certification enum validation, all-valid-options acceptance
- PROFILE-02: 2 tests covering valid project acceptance and negative contract_value rejection
- PROFILE-03: 2 tests covering name required and valid personnel acceptance

**`tests/profile/capability-statement.test.ts`** (4 tests)
- Verifies 1999-char statement accepted
- Verifies 2000-char statement accepted (boundary)
- Verifies 2001-char statement rejected
- Verifies empty string accepted

**`tests/auth/confirm.test.ts`** (4 tests)
- Verifies `export async function GET` exists
- Verifies `token_hash` is extracted from search params
- Verifies `verifyOtp` is called with `token_hash` and `type`
- Verifies redirect to `auth-code-error` on failure

## Test Results

```
Test Files  6 passed (6 project files; 6 worktree stubs skipped)
     Tests  34 passed | 6 todo (worktree stubs, out of scope)
  Duration  ~678ms
```

## Deviations from Plan

None — plan executed exactly as written. The regex patterns in the plan matched the actual SQL (using `(select auth.uid())` form) without modification.

## Decisions Made

1. **Migration-as-source-of-truth pattern:** RLS tests read the SQL migration file as a string rather than running actual database queries. This pattern requires no running Supabase instance and gives fast, reliable CI execution.

2. **File-read code-structure tests:** The checkout and auth confirm tests read source TypeScript files as strings to assert the presence of required configuration values. This is faster than mocking Next.js Route Handlers and avoids env var dependencies.

## Known Stubs

None — all test stubs in this plan's scope have been replaced with real assertions.

## Self-Check: PASSED

Files exist:
- tests/rls/cross-user-isolation.test.ts: FOUND
- tests/billing/access-gate.test.ts: FOUND
- tests/billing/trial-checkout.test.ts: FOUND
- tests/profile/profile-crud.test.ts: FOUND
- tests/profile/capability-statement.test.ts: FOUND
- tests/auth/confirm.test.ts: FOUND

Commits:
- 1542e93: test(01-05): write RLS isolation, subscription gating, and trial checkout tests
- 83cff1d: test(01-05): write profile CRUD, capability statement, and auth confirm tests
