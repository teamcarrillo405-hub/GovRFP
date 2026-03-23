@AGENTS.md

# HCC ProposalAI — Project Instructions

## What This Is

HCC ProposalAI is a standalone SaaS that turns government RFPs into submission-ready proposal drafts using Claude AI. Contractors upload an RFP (PDF or Word) → the system extracts requirements → generates a compliance matrix + win probability score → AI-drafts all proposal sections in a rich text editor → exports to Word/PDF.

**Operator:** HCC (Hispanic Contractors California)
**Target users:** Solo and small-to-mid government contractors
**Pricing:** Per-seat monthly subscription (Stripe), 14-day free trial (no card required)

---

## Session Summary — 2026-03-23

This was the **founding session** for HCC ProposalAI. Starting from an empty directory, the full product was designed and Phase 1 was executed.

### What was accomplished

1. **Project initialized** — questioned user on product vision, core flow, stack, pricing, MVP scope. Wrote PROJECT.md, REQUIREMENTS.md, ROADMAP.md.

2. **Domain research** (4 parallel researchers) — Stack, Features, Architecture, Pitfalls. Key findings:
   - Next.js **16** (not 15) — `proxy.ts` replaces `middleware.ts`
   - `@supabase/ssr` — **not** the deprecated `@supabase/auth-helpers-nextjs`
   - RFP processing must be async background job (30–90s) — cannot block HTTP
   - Win probability score is the primary market differentiator — not in any affordable GovCon tool
   - PDF parsing silent failure on scanned docs is the #1 foundation risk — OCR required from day one
   - Claude prompt caching is required from first API call — uncached full-RFP at $3/MTok destroys margin

3. **36 v1 requirements defined** across: INGEST, ANALYZE, PROFILE, AUTH, BILLING, DRAFT, EDITOR, EXPORT

4. **5-phase roadmap created:**
   - Phase 1: Foundation — Auth + billing + contractor profile ✅ COMPLETE
   - Phase 2: Document Ingestion — Upload + async parse + OCR fallback
   - Phase 3: RFP Analysis — Claude extraction + compliance matrix + win score
   - Phase 4: Proposal Drafting + Editor — Streaming AI + Tiptap + compliance live-link
   - Phase 5: Export Pipeline — Word + PDF from Tiptap JSON

5. **Phase 1 executed** — 5 plans, 4 waves, 34 tests passing:
   - Wave 0: Next.js 16 bootstrap, Supabase schema (4 tables + RLS), Vitest/Playwright
   - Wave 1 (parallel): Auth pages + Stripe billing
   - Wave 2: Contractor profile editor
   - Wave 3: Full test suite
   - Gap fixed in verification: `middleware.ts` re-export was missing (proxy.ts never invoked)

---

## Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js | 16.2.1 |
| React | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Auth + DB | Supabase (`@supabase/ssr`) | 0.9.0 |
| Billing | Stripe | v20.4.1 |
| AI | Claude API (Anthropic) | sonnet-4-6 / opus-4-6 |
| Editor | Tiptap | v2 (not v3 — API still in flux) |
| Validation | Zod | v4.3.6 |
| Tests | Vitest + Playwright | 4.1.1 + 1.58.2 |
| Word export | `docx` npm | 9.6.1 |
| PDF export | `@react-pdf/renderer` | (no Puppeteer — Vercel size limit) |

---

## Critical Conventions

### Next.js 16
- Route protection lives in `src/proxy.ts` (the session handler function) — re-exported as `middleware` from `src/middleware.ts`
- `cookies()` and `headers()` must be **awaited**
- `params` in page props must be **awaited**
- Node.js 20.9+ required

### Supabase
- Always `@supabase/ssr` — **never** `@supabase/auth-helpers-nextjs`
- Use `getUser()` not `getSession()` server-side
- `createServerClient` → server components/actions; `createBrowserClient` → client components
- Admin client (`service_role`) → webhook handlers only, never exposed to browser
- RLS policy pattern: `(select auth.uid()) = user_id` (cached form — faster)

### Stripe
- 14-day no-card trial requires **all three** together: `trial_period_days: 14` + `payment_method_collection: 'if_required'` + `trial_settings.end_behavior.missing_payment_method: 'cancel'`
- Webhook events handled: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `customer.subscription.trial_will_end`
- `invoice.paid` is the canonical provisioning event — do not rely on `checkout.session.completed` for renewals
- Stripe v20: `current_period_end` is on `SubscriptionItem`, not root `Subscription`

### Zod v4
- Error access: `parsed.error.issues` — not `parsed.error.errors` (that's v3)

### Auth flow
```
signup → signUpAction() → supabase.auth.signUp() → /check-email
email link → /auth/confirm?token_hash=...&type=email → verifyOtp() → /dashboard
login → loginAction() → signInWithPassword() → /dashboard
/reset-password → resetPasswordForEmail() → /update-password → updateUser()
```

### Subscription gating
`src/lib/billing/subscription-check.ts` → `isSubscriptionActive()`: active | trialing = true; past_due | canceled | none = false. Use this in all AI-gated routes and Server Actions.

---

## File Structure (Phase 1)

```
src/
  middleware.ts              # re-exports proxy as Next.js middleware entry point
  proxy.ts                   # session refresh + auth/dashboard routing logic
  app/
    (auth)/                  # login, signup, reset-password, update-password, check-email
    (dashboard)/             # auth + subscription guard in layout.tsx
      account/               # subscription status + Stripe billing portal
      dashboard/             # landing page with profile completion progress
      profile/               # profile editor + past-projects + key-personnel sub-routes
    api/
      billing/checkout/      # POST: create Stripe Checkout session
      billing/portal/        # POST: create Customer Portal redirect
      webhooks/stripe/       # POST: subscription lifecycle events
    auth/
      confirm/               # GET: PKCE email verification handler
  lib/
    supabase/server.ts       # createServerClient (SSR)
    supabase/client.ts       # createBrowserClient
    supabase/admin.ts        # service-role client (webhooks only)
    stripe/server.ts         # Stripe instance
    billing/subscription-check.ts  # isSubscriptionActive()
    validators/profile.ts    # Zod schemas: profileSchema, pastProjectSchema, keyPersonnelSchema
  components/profile/        # ProfileForm, PastProjectForm/Client, KeyPersonnelForm/Client
supabase/migrations/
  00001_foundation_schema.sql  # profiles, past_projects, key_personnel, proposals + RLS + trigger
tests/
  auth/confirm.test.ts           # AUTH-02
  billing/access-gate.test.ts    # BILLING-03
  billing/trial-checkout.test.ts # BILLING-01
  profile/profile-crud.test.ts   # PROFILE-01,02,03
  profile/capability-statement.test.ts  # PROFILE-04
  rls/cross-user-isolation.test.ts      # AUTH-05
```

---

## Test Commands

```bash
npx vitest run                    # 34 tests, ~600ms
npx vitest run --reporter=verbose
npx playwright test               # E2E — requires running dev server
```

---

## Environment Variables

See `.env.local.example`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY` (Phase 3+)

Stripe CLI required for local webhook testing: `scoop install stripe` (Windows).
Supabase email template must use `token_hash` URL format — configure in Supabase dashboard before first real user.

---

## Out of Scope

- Multi-user collaboration — v2
- Direct portal submission (SAM.gov) — legal risk
- RFP discovery — separate product (GovRFP)
- Custom AI fine-tuning — handled via Claude long-context injection
- Freemium tier — per-seat + 14-day trial only
- Automated price volume generation — legal exposure

---

## Next: Phase 2 — Document Ingestion

`/gsd:plan-phase 2`

- PDF + DOCX upload to Supabase Storage (50MB limit on free tier — fine for RFPs)
- Async background job — Supabase Edge Function triggered on upload
- OCR fallback for scanned PDFs — decision needed: Tesseract.js (free, lower accuracy) vs. AWS Textract (~$1.50/1000 pages)
- Job progress tracking + real-time status (Supabase Realtime)
- Parsed RFP structure sidebar (section outline + requirement list)
