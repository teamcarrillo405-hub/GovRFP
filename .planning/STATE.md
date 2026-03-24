---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
stopped_at: Completed 05-04-PLAN.md — ExportButtons component and editor integration complete
last_updated: "2026-03-24T19:39:00.814Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 22
  completed_plans: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Reduce the time from RFP receipt to first compliant proposal draft from days to under 30 minutes
**Current focus:** Phase 05 — export-pipeline

## Current Position

Phase: 05
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 9 | 2 tasks | 23 files |
| Phase 01-foundation P02 | 4 | 2 tasks | 12 files |
| Phase 01-foundation P03 | 5 | 2 tasks | 7 files |
| Phase 01-foundation P04 | 294 | 2 tasks | 13 files |
| Phase 01-foundation P05 | 5 | 2 tasks | 6 files |
| Phase 02-document-ingestion P01 | 525642 | 2 tasks | 14 files |
| Phase 02-document-ingestion P02 | 4 min | 2 tasks | 7 files |
| Phase 02-document-ingestion P03 | 15 | 2 tasks | 5 files |
| Phase 02-document-ingestion P04 | 4 min | 2 tasks | 5 files |
| Phase 03-rfp-analysis P01 | 8 | 2 tasks | 9 files |
| Phase 03-rfp-analysis P02 | 198 | 2 tasks | 6 files |
| Phase 03-rfp-analysis P03 | 8 | 2 tasks | 3 files |
| Phase 04-proposal-drafting-editor P01 | 12 | 2 tasks | 12 files |
| Phase 04-proposal-drafting-editor P03 | 5 | 2 tasks | 6 files |
| Phase 04-proposal-drafting-editor P02 | 9 | 2 tasks | 5 files |
| Phase 04-proposal-drafting-editor P04 | 12 | 2 tasks | 8 files |
| Phase 04-proposal-drafting-editor P05 | 10 | 2 tasks | 1 files |
| Phase 05-export-pipeline P01 | 5 | 2 tasks | 7 files |
| Phase 05-export-pipeline P02 | 5 | 2 tasks | 4 files |
| Phase 05-export-pipeline P03 | 7 | 2 tasks | 4 files |
| Phase 05-export-pipeline P04 | 2 | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Phase order is non-negotiable — profile before AI drafting, parse pipeline before Claude, compliance matrix before editor live-linking
- [Roadmap]: Prompt caching and OCR fallback architecture must be designed in Phase 2, not retrofitted — cost blowout and parse reliability are catastrophic post-launch risks
- [Roadmap]: Stripe subscription enforcement in middleware from Phase 1 — never added as a separate billing phase later
- [Roadmap]: Tiptap JSON (not HTML) is the editor storage format from day one — affects Phase 4 build order and Phase 5 export converter
- [Phase 01-foundation]: Used @supabase/ssr (not deprecated @supabase/auth-helpers-nextjs) for Next.js 16 App Router cookie-based sessions
- [Phase 01-foundation]: Moved .planning and .git temporarily during create-next-app bootstrap to avoid non-empty-directory error
- [Phase 01-foundation]: parseCookieHeader value coercion: map undefined to empty string to satisfy CookieMethodsServer type constraint in proxy.ts
- [Phase 01-foundation]: proxy.ts uses getUser() not getSession() for all session validation — validates JWT against Supabase server-side
- [Phase 01-foundation]: Stripe v20: current_period_end is on SubscriptionItem (items.data[0]), not Subscription root — must use subscription.items.data[0].current_period_end in webhook handlers
- [Phase 01-foundation]: Billing DB writes use createAdminClient (service_role) in webhooks to bypass RLS — stripe_customer_id is the lookup key since webhooks have no user session
- [Phase 01-foundation]: Client wrapper pattern (PastProjectsClient/KeyPersonnelClient) for interactive CRUD: keeps RSC benefits while enabling inline form toggling without full-page round-trips
- [Phase 01-foundation]: Zod 4 uses .issues not .errors on ZodError — plan specs used .errors which does not exist; fixed to .issues in all server actions
- [Phase 01-foundation]: Migration-as-source-of-truth: RLS tests read SQL migration file directly to assert policy presence — no running Supabase needed in CI
- [Phase 01-foundation]: File-read code-structure tests: billing and auth tests read source files as strings to assert config constants — avoids mocking Next.js or Stripe
- [Phase 02-document-ingestion]: Used archiver dev dep for DOCX fixture generation (archiver was not pre-installed, docx package absent)
- [Phase 02-document-ingestion]: Fixed tsconfig.json target ES2017->ES2018 to allow dotAll regex flag used in existing Phase 1 RLS tests
- [Phase 02-document-ingestion]: Import from 'unpdf' not 'unpdf/serverless' — v1.4.0 has no serverless sub-path; Node 24 supports Promise.withResolvers natively
- [Phase 02-document-ingestion]: isScannedPdf uses every-page-below-threshold logic (all pages must be below 100 chars)
- [Phase 02-document-ingestion]: Excluded supabase/functions from tsconfig.json — Deno runtime incompatible with Node.js tsc
- [Phase 02-document-ingestion]: Upload route returns 402 for inactive subscription; checkSubscription+isSubscriptionActive matches actual export signature
- [Phase 02-document-ingestion]: ProcessingStatus reloads window on completed so RSC re-fetches rfp_text/rfp_structure — avoids client-side state sync complexity
- [Phase 03-rfp-analysis]: AnalysisRequirement (not RfpRequirement) to avoid Phase 2 rfp-structure.ts interface collision
- [Phase 03-rfp-analysis]: ANTHROPIC_API_KEY lives only in Supabase Edge Function secrets -- never in .env.local
- [Phase 03-rfp-analysis]: claim_next_job(p_job_type) polymorphic job queue -- extend by adding new job_type values, not new tables
- [Phase 03-rfp-analysis]: 8(a) regex: trailing \b after ')' fails -- replaced with (?\!\w) negative lookahead
- [Phase 03-rfp-analysis]: cache_control on rfp_text system block only — instructions block changes per call, no caching
- [Phase 03-rfp-analysis]: failJob() leaves proposal at ready on analysis failure — user keeps parsed document view
- [Phase 04-proposal-drafting-editor]: @anthropic-ai/sdk promoted to production dependency — Phase 4 draft generation runs from Next.js App Router route handler, not Edge Function
- [Phase 04-proposal-drafting-editor]: ANTHROPIC_API_KEY now required in both Supabase Edge Function secrets AND .env.local for Phase 4+
- [Phase 04-proposal-drafting-editor]: TOPIC_TO_SECTIONS mapping: Technical topic applies to Executive Summary and Technical Approach; Other applies to same two sections
- [Phase 04-proposal-drafting-editor]: Keyword threshold: 60%+ = addressed, 30-59% = partial, <30% = unaddressed; only 4+ letter words counted
- [Phase 04-proposal-drafting-editor]: cache_control ephemeral on rfp_text system block only — instruction block changes per call so cannot be cached
- [Phase 04-proposal-drafting-editor]: Promise.all for 5 parallel Supabase fetches before streaming — minimizes pre-stream latency
- [Phase 04-proposal-drafting-editor]: SSE buffer pattern: write to editor once on stream close, not per-chunk — avoids cursor disruption during streaming
- [Phase 04-proposal-drafting-editor]: Auto-save guards use useRef (not useState) to avoid stale closures in setInterval callback
- [Phase 04-proposal-drafting-editor]: SectionEditor exposes editor via forwardRef/useImperativeHandle — parent needs editor reference for streaming setContent
- [Phase 04-proposal-drafting-editor]: Draft Proposal button positioned above View Analysis — drafting is primary CTA post-analysis
- [Phase 04-proposal-drafting-editor]: Human verified Phase 4 complete: streaming, editing, auto-save, compliance panel, no emojis all confirmed
- [Phase 05-export-pipeline]: serverExternalPackages: ['@react-pdf/renderer'] in next.config.ts prevents TypeError in App Router route handlers — Next.js react-server condition strips react-reconciler internals without this config
- [Phase 05-export-pipeline]: Ordered lists use manual text prefix (1. 2.) instead of docx numbering XML — avoids AbstractNumbering/ConcreteNumbering XML requirement
- [Phase 05-export-pipeline]: stripComplianceMarks called in route handler before converter — keeps converter pure
- [Phase 05-export-pipeline]: Proposal title loaded from proposals table and sanitized for Content-Disposition filename
- [Phase 05-export-pipeline]: React.createElement (not JSX) used in tiptap-to-pdf.ts — .ts files cannot use JSX syntax without Babel transform
- [Phase 05-export-pipeline]: PDF export uses 'LETTER' page size — US government submission standard, not A4
- [Phase 05-export-pipeline]: export const runtime = 'nodejs' in PDF route — prevents edge runtime + react-reconciler conflict
- [Phase 05-export-pipeline]: Word button uses accent fill (bg-blue-700) as primary action; PDF uses outline as secondary — Word is submission format, PDF is review-only
- [Phase 05-export-pipeline]: ExportButtons uses independent loading state per button — downloading Word does NOT disable PDF button (each fetch lifecycle is separate)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: OCR fallback strategy unresolved — Tesseract.js vs. AWS Textract vs. Google Document AI tradeoffs need research before Phase 2 planning
- [Phase 4]: Tiptap streaming AI injection edge cases (cursor behavior, ProseMirror transaction handling) need proof-of-concept before Phase 4 planning
- [Phase 1]: Per-user token budget UX (hard cutoff vs. soft warning, what counts toward limits) needs product decision before billing plans are written

## Session Continuity

Last session: 2026-03-24T19:18:07.183Z
Stopped at: Completed 05-04-PLAN.md — ExportButtons component and editor integration complete
Resume file: None
