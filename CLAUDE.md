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

## Phase 2 — Document Ingestion (COMPLETE 2026-03-23)

### Architecture decisions locked
- **OCR:** AWS Textract `DetectDocumentText` (sync, bytes ≤10MB) — NOT Tesseract.js (85MB wasm, 85-90% accuracy, OOM risk in Edge Function)
- **Async jobs:** Postgres `document_jobs` table + pg_cron + Supabase Edge Function — NOT storage.objects webhook (double-trigger footgun) or Inngest
- **PDF parsing:** `unpdf` 1.4.0 — import from `'unpdf/serverless'` (not default) to avoid Promise.withResolvers crash on Node 20
- **DOCX parsing:** `mammoth` 1.12.0 — `extractRawText({buffer})`
- **Real-time:** Supabase Realtime Postgres Changes on `document_jobs` filtered by `proposal_id`
- **File upload:** Signed upload URL (browser → Supabase Storage directly, bypasses 4.5MB Vercel limit)
- **INGEST-05:** Store `rfp_structure` JSON in Phase 2 (regex heuristic); sidebar React component deferred to Phase 4

### Plans
- [x] 02-01-PLAN.md — Wave 0: packages + migration + test stubs
- [x] 02-02-PLAN.md — Wave 1: PDF/DOCX/Textract parsing library
- [x] 02-03-PLAN.md — Wave 1 (parallel): upload API route + Edge Function
- [x] 02-04-PLAN.md — Wave 2: FileUpload + ProcessingStatus + proposal pages

### New env vars
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (default: us-east-1)

### Supabase manual config (cannot be automated via migration)
- Create `rfp-documents` bucket: private, 50MB limit, MIME types: pdf + docx
- Enable Realtime on `document_jobs` table (Database > Replication)
- Add pg_cron job: `* * * * *` (every 60s, fallback from 15s — verify sub-minute support in dashboard)
- Add Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

### Execution deviations (auto-fixed during build)
- `unpdf` v1.4.0 has no `serverless` sub-path export — use `from 'unpdf'` directly (Node 24 has native `Promise.withResolvers`)
- `unpdf` `extractText()` returns `{ totalPages, text: string[] }` — not a plain string or array
- `supabase/functions/` excluded from `tsconfig.json` (Deno globals break Node tsc)
- `isSubscriptionActive()` signature: `(status: string | null, trialEndsAt: string | null): boolean`

### Tests: 69 passing across 11 test files

### File structure (Phase 2 additions)
```
src/
  app/
    (dashboard)/
      proposals/
        new/page.tsx            # Upload form — subscription gated
        [id]/page.tsx           # Proposal detail — status + doc info (await params)
    api/
      documents/
        upload-url/route.ts     # POST: auth + subscription + signed URL + DB rows
  components/
    documents/
      FileUpload.tsx            # 'use client' — file picker, direct Storage PUT
      ProcessingStatus.tsx      # 'use client' — Realtime postgres_changes on document_jobs
  lib/
    documents/
      parse-pdf.ts              # extractPdfText(), isScannedPdf() — uses 'unpdf'
      parse-docx.ts             # parseDocx() — mammoth.extractRawText
      textract.ts               # extractTextWithTextract() — DetectDocumentTextCommand, 10MB guard
      rfp-structure.ts          # extractRfpStructure() — regex: sections + shall/must/will
supabase/
  migrations/
    00002_document_ingestion.sql  # document_jobs table + claim_next_document_job() + proposals columns
  functions/
    process-documents/
      index.ts                  # Deno Edge Function: job poll → parse → OCR → update proposals
tests/
  documents/
    upload-url.test.ts          # INGEST-01,02 — route unit tests
    parse-pdf.test.ts           # INGEST-03 — isScannedPdf heuristic unit tests
    parse-docx.test.ts          # INGEST-02 — mammoth extraction
    job-queue.test.ts           # INGEST-04 — migration structural + atomic claim
    rfp-structure.test.ts       # INGEST-05 — section + requirement extraction
  fixtures/
    sample.pdf, sample-scanned.pdf, sample.docx
```

### Manual setup required before Phase 2 works in production
1. Create `rfp-documents` Supabase Storage bucket: private, 50MB, MIME types pdf+docx
2. Enable Realtime on `document_jobs` table (Dashboard > Database > Replication)
3. Add pg_cron job: `* * * * *` calling `process-documents` Edge Function via `net.http_post`
4. Set Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
5. Run migration `00002_document_ingestion.sql`


## Phase 3 — RFP Analysis (COMPLETE 2026-03-23)

### Architecture decisions locked
- **Model:** `claude-sonnet-4-6` — 1M context window; no chunking needed for any real RFP
- **Prompt caching:** `cache_control: { type: 'ephemeral' }` on the `rfp_text` system block ONLY — saves ~47% per analysis (~$0.30 vs $0.57 for 50-page RFP)
- **Structured extraction:** `strict: true` tool_use + `tool_choice: { type: 'tool', name: '...' }` — 3 sequential calls, all hitting cache on calls 2+3
- **ANALYZE-04:** Pure regex (no LLM) — SET_ASIDE_PATTERNS + FAR 52.219-* clause number detection
- **Win probability:** Hybrid — Claude assesses scope_alignment×0.30, past_perf×0.15, competition×0.10; computed certifications_match×0.25, set_aside_match×0.20
- **Job queue:** Extend `document_jobs` with `job_type` column; `claim_next_job(p_job_type)` + backward-compat alias `claim_next_document_job()`
- **ANTHROPIC_API_KEY:** Supabase Edge Function secret ONLY — never in `.env.local`
- **Data model:** `rfp_analysis` table (single row per proposal) with JSONB columns + GIN indexes

### Plans
- [x] 03-01-PLAN.md — Wave 0: DB migration (rfp_analysis + job_type) + TypeScript types + test stubs
- [x] 03-02-PLAN.md — Wave 1: set-aside-detector, section-lm-detector, win-score utility library
- [x] 03-03-PLAN.md — Wave 1 (parallel): analyze-proposal Edge Function (3 Claude calls) + process-documents update
- [x] 03-04-PLAN.md — Wave 2: ComplianceMatrix, WinScoreCard, SetAsideFlags, SectionLMCrosswalk UI + analysis page

### Execution deviations (auto-fixed during build)
- `8(a)` regex `\b8\s*\(a\)\b` always fails (`)` not a word char) — auto-fixed to `\b8\s*\(a\)(?!\w)` (negative lookahead)
- Prompt caching: `cache_control` goes on SECOND system block (rfp_text) only — first block (instructions) has no cache_control

### Tests: 102 passing across 16 test files

### File structure (Phase 3 additions)
```
src/
  lib/
    analysis/
      types.ts                  # AnalysisRequirement, ComplianceMatrixRow, WinFactors, SetAsideFlag, SectionLMEntry, RfpAnalysis, WIN_SCORE_WEIGHTS
      set-aside-detector.ts     # detectSetAsides(), detectPrimarySetAside(), generateSetAsideFlags() — pure regex
      section-lm-detector.ts    # detectSectionLM() — 6 Section L + 6 Section M patterns
      win-score.ts              # computeWinScore(), computeCertificationsScore(), computeSetAsideScore()
  components/
    analysis/
      ComplianceMatrix.tsx      # requirements table with mandatory/desired + coverage badges
      WinScoreCard.tsx          # score + 5-factor breakdown with bars and reasoning
      SetAsideFlags.tsx         # match/no-match badges with inline SVG icons
      SectionLMCrosswalk.tsx    # L/M table; blue notice for non-UCF solicitations
  app/
    (dashboard)/
      proposals/
        [id]/
          analysis/page.tsx     # Server page: auth + rfp_analysis load + 4 sub-components
supabase/
  migrations/
    00003_rfp_analysis.sql      # rfp_analysis table + GIN indexes + job_type column + claim_next_job() + backward-compat alias
  functions/
    analyze-proposal/
      index.ts                  # Deno Edge Function: claim job → 3 Claude calls (cached) → hybrid win score → upsert rfp_analysis
tests/
  analysis/
    set-aside-detector.test.ts  # ANALYZE-04 — 8 program patterns + FAR clause fallback
    win-score.test.ts           # ANALYZE-03 — weighted average + certifications/set-aside computation
    section-lm-detector.test.ts # ANALYZE-05 — Section L/M pattern detection
    analysis-job-queue.test.ts  # job_type column + claim_next_job() structural tests
    rfp-analysis-schema.test.ts # rfp_analysis migration structure + GIN index verification
```

### Manual setup required before Phase 3 works in production
1. Set Supabase Edge Function secret: `ANTHROPIC_API_KEY`
2. Add second pg_cron job: `* * * * *` calling `analyze-proposal` Edge Function
3. Run migration `00003_rfp_analysis.sql`
