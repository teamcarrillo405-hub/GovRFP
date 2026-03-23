---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + Playwright 1.58.2 |
| **Config file** | `vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx playwright test --project=chromium` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx playwright test --project=chromium`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | AUTH-01–05, BILLING-01–05, PROFILE-01–04 | setup | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | AUTH-01 | e2e | `npx playwright test auth/signup.spec.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | AUTH-02 | unit | `npx vitest run tests/auth/confirm.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | AUTH-03 | e2e | `npx playwright test auth/session-persistence.spec.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | AUTH-04 | e2e | `npx playwright test auth/password-reset.spec.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | AUTH-05 | integration | `npx vitest run tests/rls/cross-user-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | BILLING-01 | unit | `npx vitest run tests/billing/trial-checkout.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | BILLING-02 | e2e | `npx playwright test billing/checkout.spec.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | BILLING-03 | integration | `npx vitest run tests/billing/access-gate.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | BILLING-04 | unit | `npx vitest run tests/billing/portal.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | BILLING-05 | e2e | `npx playwright test billing/cancel.spec.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | PROFILE-01 | integration | `npx vitest run tests/profile/profile-crud.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | PROFILE-02 | integration | `npx vitest run tests/profile/past-projects.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | PROFILE-03 | integration | `npx vitest run tests/profile/key-personnel.test.ts` | ❌ W0 | ⬜ pending |
| 1-xx-xx | TBD | TBD | PROFILE-04 | unit | `npx vitest run tests/profile/capability-statement.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files are missing — project is greenfield. The following must exist before execution begins:

- [ ] `vitest.config.ts` — test framework configuration
- [ ] `playwright.config.ts` — E2E configuration (baseURL, browser projects)
- [ ] `tests/setup.ts` — Vitest global setup (test Supabase client, Stripe test keys)
- [ ] `tests/auth/confirm.test.ts` — stubs for AUTH-02 (email verification route handler)
- [ ] `tests/auth/session-persistence.spec.ts` (Playwright) — stubs for AUTH-03
- [ ] `tests/rls/cross-user-isolation.test.ts` — stubs for AUTH-05 (CRITICAL: run before any file storage added)
- [ ] `tests/billing/trial-checkout.test.ts` — stubs for BILLING-01
- [ ] `tests/billing/access-gate.test.ts` — stubs for BILLING-03
- [ ] `tests/profile/profile-crud.test.ts` — stubs for PROFILE-01
- [ ] `tests/profile/capability-statement.test.ts` — stubs for PROFILE-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase email template sends PKCE token_hash URL | AUTH-02 | Requires Supabase dashboard config + real email delivery | Send a real signup email in staging; verify the link format is `?token_hash=...&type=email` not the legacy `?token=...` format |
| Stripe Customer Portal shows subscription status | BILLING-04 | Requires active Stripe test subscription | Create test subscription via Stripe test mode, click "Manage Billing" in account settings, confirm next billing date and plan are visible |
| 14-day trial shows no card requirement | BILLING-01 | Requires Stripe hosted Checkout page | Click "Start Free Trial" in test mode, verify no credit card field appears on the Checkout page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
