---
phase: 01-foundation
plan: 03
subsystem: payments
tags: [stripe, subscription, billing, webhook, customer-portal, supabase]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "01-01: Next.js scaffold, Supabase schema (profiles table with billing columns), admin client"

provides:
  - Stripe Checkout route with 14-day no-card trial (payment_method_collection: if_required)
  - Stripe webhook handler for full subscription lifecycle (6 events)
  - Stripe Customer Portal redirect route
  - checkSubscription and isSubscriptionActive utility functions
  - Dashboard layout with auth guard and past_due/canceled banner
  - Account settings page with subscription status, dates, and billing action buttons

affects:
  - 01-04-profile (uses dashboard layout, checkSubscription for gating)
  - 02-document-ingestion (subscription gating on upload and parse)
  - 03-ai-drafting (subscription gating on Claude API calls)
  - all future phases (subscription.isActive gates AI features)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stripe v20: current_period_end lives on SubscriptionItem (subscription.items.data[0].current_period_end), not Subscription root"
    - "Webhook: use request.text() for raw body in App Router (NOT Pages Router bodyParser: false)"
    - "Admin client (service_role) used for all billing DB writes to bypass RLS"
    - "Dashboard layout as auth guard: redirect to /login if no session, show banner on lapse"
    - "BillingButtons as client component wrapping server-rendered account page"

key-files:
  created:
    - src/app/api/billing/checkout/route.ts
    - src/app/api/billing/portal/route.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/lib/billing/subscription-check.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/account/page.tsx
    - src/app/(dashboard)/account/billing-buttons.tsx
  modified: []

key-decisions:
  - "Stripe v20 subscription item carries current_period_end — accessed via subscription.items.data[0].current_period_end not top-level property"
  - "payment_method_collection: if_required + trial_settings.end_behavior.missing_payment_method: cancel implements no-card trial that auto-cancels at expiry"
  - "All webhook DB writes use createAdminClient (service_role) — stripe_customer_id used as lookup key since no user session in webhooks"
  - "Dashboard layout is the auth gate — all (dashboard) routes are protected without per-page redirects"

patterns-established:
  - "Pattern 1: Stripe webhook pattern — request.text() for raw body, stripe.webhooks.constructEvent for verification, return 400 only on signature failure"
  - "Pattern 2: Subscription gating — checkSubscription(userId) returns isActive boolean; use this in API routes before AI calls"
  - "Pattern 3: BillingButtons as isolated client component — server page renders status/dates, client component owns fetch+redirect logic"

requirements-completed: [BILLING-01, BILLING-02, BILLING-03, BILLING-04, BILLING-05]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 1 Plan 03: Stripe Billing Integration Summary

**Stripe Checkout with 14-day no-card trial, webhook lifecycle handler for 6 events, Customer Portal redirect, and subscription status gating utility with account settings page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T17:08:16Z
- **Completed:** 2026-03-23T17:13:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Stripe Checkout session creation with 14-day trial (no credit card required), auto-cancel at trial end
- Webhook handler covering all 6 subscription lifecycle events with Stripe v20 type-safe implementation
- Subscription check utility (`checkSubscription`, `isSubscriptionActive`) for use across all AI-gated routes
- Account page with color-coded status badge, trial/billing dates, and client-side billing action buttons
- Dashboard layout protecting all routes under `(dashboard)` group with auth redirect and lapse banner

## Task Commits

Each task was committed atomically:

1. **Task 1: Stripe checkout, webhook handler, and Customer Portal routes** - `3bdca45` (feat)
2. **Task 2: Subscription check utility and account settings page** - `cd37392` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/app/api/billing/checkout/route.ts` - POST: creates Stripe customer if needed, Checkout session with 14-day no-card trial
- `src/app/api/billing/portal/route.ts` - POST: creates Customer Portal session for subscription management
- `src/app/api/webhooks/stripe/route.ts` - POST: handles checkout.session.completed, invoice.paid, customer.subscription.updated/deleted, invoice.payment_failed, customer.subscription.trial_will_end
- `src/lib/billing/subscription-check.ts` - checkSubscription() and isSubscriptionActive() exported utilities
- `src/app/(dashboard)/layout.tsx` - Auth guard, past_due/canceled banner for all dashboard routes
- `src/app/(dashboard)/account/page.tsx` - Server component: displays email, status badge, trial/billing dates
- `src/app/(dashboard)/account/billing-buttons.tsx` - Client component: Start Free Trial and Manage Billing buttons with fetch+redirect

## Decisions Made
- Used Stripe v20's `subscription.items.data[0].current_period_end` instead of non-existent top-level `current_period_end` (auto-fixed via TypeScript error)
- All webhook DB writes use `createAdminClient` (service_role key) to bypass RLS — webhooks have no user session context
- `payment_method_collection: 'if_required'` with `trial_settings.end_behavior.missing_payment_method: 'cancel'` implements the required no-card-required trial behavior (BILLING-01)
- BillingButtons isolated as client component so account page remains a server component for SSR subscription data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe v20 current_period_end access on customer.subscription.updated**
- **Found during:** Task 1 (webhook handler)
- **Issue:** Plan referenced `subscription.current_period_end` but Stripe v20 moved this field to `SubscriptionItem` — TypeScript error `Property 'current_period_end' does not exist on type 'Subscription'`
- **Fix:** Changed to `subscription.items?.data?.[0]?.current_period_end` with null safety
- **Files modified:** src/app/api/webhooks/stripe/route.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 3bdca45 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — Stripe v20 API change)
**Impact on plan:** Required fix for type safety and runtime correctness. No scope creep.

## Issues Encountered
- Existing `src/proxy.ts` has a pre-existing TypeScript error (Supabase SSR cookie type mismatch) — out of scope for this plan, logged to deferred items

## User Setup Required
External services require manual configuration before billing works in development:

1. **Stripe environment variables** — Add to `.env.local`:
   - `STRIPE_SECRET_KEY` — from Stripe Dashboard > Developers > API keys
   - `STRIPE_PRICE_ID` — from Stripe Dashboard > Products (create a recurring subscription product)
   - `STRIPE_WEBHOOK_SECRET` — from `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - `NEXT_PUBLIC_URL` — set to `http://localhost:3000` for development
2. **Stripe CLI** — Install for local webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. **Stripe Customer Portal** — Enable in Stripe Dashboard > Billing > Customer Portal > Settings

## Next Phase Readiness
- Billing API routes ready; `checkSubscription` available for Phase 1 Plan 04 (contractor profile) subscription gating
- All AI-gated API routes in future phases should call `checkSubscription(userId)` and return 403 if `!isActive`
- Pre-existing proxy.ts TypeScript error should be resolved before Phase 2

## Self-Check: PASSED

All 7 files confirmed present on disk. Both task commits (3bdca45, cd37392) confirmed in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-23*
