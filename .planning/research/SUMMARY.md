# Project Research Summary

**Project:** HCC ProposalAI
**Domain:** AI-assisted RFP proposal writing SaaS (government contracting)
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

HCC ProposalAI is a government proposal acceleration tool built for small and mid-size contractors — primarily HCC member firms — who currently spend 25–40+ hours manually writing each proposal response. The product solves a well-defined, painful workflow: upload an RFP, receive a compliance matrix and AI-drafted proposal sections in under 30 minutes, edit in a browser-based rich text editor, and export a submission-ready Word or PDF document. The target market is underserved by existing tools: enterprise GovCon platforms (GovDash, AutogenAI, Unanet) are priced and designed for large BD teams, while general-purpose RFP tools (Loopio, Responsive) lack GovCon-specific features like Section L/M parsing, FAR Part 15 awareness, and small business certification matching. HCC ProposalAI occupies the gap: GovCon-aware AI drafting at solo contractor pricing.

The recommended approach is a Next.js 15 + Supabase + Claude API stack with a five-layer architecture: browser editor, API route handlers, service layer (Claude, ingest, export), Supabase data layer, and a Supabase Edge Function background job processor. The most important architectural decision is the async job queue pattern — RFP processing takes 30–90 seconds and cannot block the HTTP response. Document parsing, Claude extraction, compliance matrix generation, and initial section drafting all run in a background worker. The browser polls or subscribes to Supabase Realtime for status. Streaming is used only for user-initiated section generation and regeneration, where latency is directly perceived.

The two highest risks are (1) Claude API cost blowout from uncontrolled token usage — mitigated by prompt caching on the RFP document block from the first API call, and model tiering (Sonnet for drafts, Opus only for win score reasoning); and (2) compliance matrix hallucination — mitigated by strict grounding prompts that require verbatim source citations for every extracted requirement. Both risks are catastrophic if discovered post-launch: cost blowout destroys margins at scale, and hallucinated compliance items create legal exposure for HCC member contractors submitting government bids. These must be designed in from Phase 1, not patched later.

---

## Key Findings

### Recommended Stack

The stack is well-established for this domain with minimal ambiguity. Next.js 15 (App Router) is the correct starting point — 14 is in maintenance and 15's caching model is more correct for per-user SaaS data. Supabase handles auth, database, storage, and Realtime in a single integrated service, eliminating the need for separate auth and file storage providers. The Claude API (Anthropic native SDK) handles all AI tasks; the `@ai-sdk/anthropic` adapter can be used for streaming section drafts via the Vercel AI SDK pattern. Tiptap is the correct rich text editor — ProseMirror-based, React-native, and headless, with the extension ecosystem needed for compliance highlighting.

The one non-obvious stack decision: use `@react-pdf/renderer` for PDF export, not Puppeteer. Puppeteer's Chromium binary exceeds Vercel's 50MB serverless function size limit and deployments will fail. Use `docx` (v9.x) for Word export, built via a typed Tiptap-JSON-to-docx converter — not `html-docx-js`, which produces lossy conversions.

**Core technologies:**
- **Next.js 15 (App Router):** Full-stack React framework — correct caching defaults for per-user SaaS; Turbopack dev server; React Server Components + Server Actions for AI streaming and form handling
- **React 19:** Required peer dep for Next.js 15 — enables concurrent features and Server Components
- **TypeScript 5.x:** Required for this domain — compliance matrix schemas, proposal section types, and Stripe webhook payloads need strict typing
- **Supabase (JS SDK v2.99+):** Database, auth, file storage, Realtime, Edge Functions in one service — eliminates need for separate auth and storage providers; RLS handles per-user data isolation
- **Claude API (claude-sonnet-4-6 default / claude-opus-4-6 for win score):** Only AI option per project constraints; Sonnet for all drafting, Opus only for win probability reasoning
- **Stripe (stripe@17.x + @stripe/stripe-js@5.x):** Per-seat subscription billing — handles SCA, renewals, and trial lifecycle
- **Tiptap (@tiptap/core 2.x):** ProseMirror-based headless editor — best extension ecosystem for compliance highlighting and AI content injection
- **Zod (3.x):** Runtime validation of all Claude structured outputs — never parse AI responses without schema validation
- **@tanstack/react-query (5.x):** Client-side polling for job status, optimistic updates during editing
- **docx (9.6.x) + @react-pdf/renderer (4.x):** Word and PDF export server-side — no Puppeteer on Vercel

See `.planning/research/STACK.md` for full version compatibility table, model selection guide, and what NOT to use.

---

### Expected Features

The GovCon proposal writing space has a clear MVP floor — features users assume exist — and a narrow set of true differentiators for the small business market. The feature dependency graph is critical: AI drafting requires a contractor profile, compliance gap highlighting requires both the compliance matrix and the editor, and win probability scoring requires parsed RFP content. Phase order must follow these dependencies.

**Must have (table stakes):**
- PDF + DOCX RFP upload — no upload, no product; must handle scanned PDFs via OCR fallback
- AI requirement extraction (Section L/M separated, shall/must/will statements) — foundational parse step
- Compliance matrix generation with mandatory/desired flagging — first deliverable contractors expect
- Contractor profile (certifications, NAICS, past projects, key personnel, capability statement) — required for non-generic AI output
- AI-drafted proposal sections (Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative) — core time-saver
- Section-level regeneration with custom instructions — iterating on weak sections
- In-browser rich text editor with auto-save — modern expectation; downloading to edit kills adoption
- RFP structure sidebar — keeps requirements visible during editing; reduces missed items
- Compliance matrix live-linked to editor (requirement coverage status) — closes the compliance loop
- Win probability score (0–100) with 4–5 factor reasoning — go/no-bid decision support; key differentiator vs. general RFP tools
- Export to Word (.docx) — submission format required by most agencies
- Export to PDF — review and internal distribution
- Per-seat subscription billing (Stripe) — revenue model
- Solo account auth + secure document storage — basic security and persistence

**Should have (competitive differentiators, add post-validation):**
- Section L/M cross-reference crosswalk table — saves 2–4 hours per proposal for experienced proposal managers
- Past performance auto-narrative tailored to current RFP scope — contractors rewrite the same project descriptions every time
- Real-time compliance gap highlighting in editor — surfaces missed requirements while editing, not after
- Small business set-aside certification matching — low complexity, high signal for HCC target market

**Defer (v2+):**
- Multi-user team collaboration — adds auth/permissions complexity; validate solo workflow first
- Version history with diff view — useful but not mission-critical for solo users
- GovRFP deep-link integration — requires coordination between two products
- Agency-specific template library — requires curation effort; defer until usage patterns reveal agency concentration

See `.planning/research/FEATURES.md` for competitor feature matrix and full feature dependency graph.

---

### Architecture Approach

The system follows a five-layer architecture: browser (Next.js RSC + Tiptap client), API route handlers (thin — validate, delegate, return), service layer (ClaudeService, IngestService, ExportService), Supabase data layer (Postgres, Storage, Realtime), and a Supabase Edge Function background job processor. The key architectural insight is that all long-running work (document parsing + Claude extraction pipeline) is offloaded to the background job worker, which runs independently of the HTTP request cycle. The browser receives a `{ jobId }` immediately and subscribes to Realtime for status updates. Streaming is reserved for user-triggered section generation, where perceived latency matters.

Three core patterns drive the architecture:
1. **Async job queue** for document ingestion (30–90 second pipeline cannot block HTTP)
2. **Streaming SSE** for section drafting (user sees words appear, not a 20-second spinner)
3. **Structured output with Zod schemas** for compliance matrix and win score extraction (never raw text parsing)

**Major components:**
1. **IngestService + Edge Function job processor** — file download from Storage, PDF/DOCX text extraction, Claude structured extraction pipeline, compliance matrix generation; runs async in background
2. **ClaudeService** — encapsulates all Anthropic SDK calls; prompts are code in typed files, not string literals; Zod schemas enforce structure; separated by task (rfp-extraction, compliance-matrix, section-draft, win-score)
3. **Tiptap Editor + ComplianceMatrix UI** — ProseMirror-based editor with live-linked compliance sidebar; editor content stored as Tiptap JSON (not HTML); auto-save debounced 2 seconds
4. **ExportService** — converts Tiptap JSON to typed docx constructs via the `docx` library; separate to-pdf path via `@react-pdf/renderer`; both run as server-side route handlers
5. **ContractorProfile** — Postgres table injected into Claude prompts at generation time (not embedded at parse time — fetched fresh so profile updates apply to regenerations)
6. **Auth + Billing middleware** — Supabase SSR session validation + Stripe subscription status check before every `/api/generate` call; subscription check in middleware, not only on page load

See `.planning/research/ARCHITECTURE.md` for full data flow diagram, build order, and anti-pattern descriptions.

---

### Critical Pitfalls

Five pitfalls have HIGH recovery cost or immediate production failure risk. These are not edge cases — they are predictable failures in this domain.

1. **PDF parsing reliability — garbled text and silent failures on scanned government RFPs** — government agencies frequently publish scanned PDFs; `pdf-parse` returns empty strings (not errors) on image pages, silently producing an incomplete compliance matrix. Prevention: detect PDF type before parsing; route scanned PDFs through OCR (Tesseract or managed service); validate parse quality with character count and section detection metrics; surface a "parse quality" badge to users. Address in: Document Ingestion phase.

2. **Claude API cost blowout from uncontrolled token usage** — a 150k-token RFP sent on every API call (6+ calls per proposal session) costs ~$2.70 in input tokens at Sonnet pricing; at 100 proposals/month, that wipes out per-seat margins before scaling. Prevention: implement `cache_control` on the RFP document block from the first API call (78% cost reduction); track `ai_cost_cents` per proposal in the database; implement per-user monthly token budgets. Address in: Document Ingestion architecture — must be designed before the first API call is written.

3. **Compliance matrix hallucination — invented requirements and false coverage claims** — Claude pattern-matches on training data and may generate requirements it expects to see in a typical RFP, not only requirements present in the uploaded document; false "addressed" markers can cause bid disqualification or legal exposure for HCC members. Prevention: strict grounding prompts requiring verbatim source citations for every row; two-pass extraction (section headings first, then requirements per section); display page/section citations in the UI; "human review required" disclaimer. Address in: Compliance Matrix phase.

4. **Rich text editor complexity underestimated** — ProseMirror's schema and transaction system has a steep learning curve; pasting from Word introduces unwanted styles, AI content injection can reset cursor position, and editor state diverges from the database if stored as HTML. Prevention: commit to Tiptap from day one; store content as Tiptap JSON (not HTML); use `setContent`/`insertContentAt` for AI injection; configure paste sanitization; test AI streaming insertion before wiring to Claude. Address in: Rich Text Editor phase.

5. **Word/PDF export fidelity gap** — exported `.docx` heading levels flatten, numbered lists restart, and table formatting breaks; PDF has font substitution issues across environments. Prevention: build a typed Tiptap-JSON-to-docx converter using the `docx` library directly (not `html-docx-js`); use `@react-pdf/renderer` for PDF to avoid environment font dependencies; add visual regression tests for export. Address in: Export phase (data model decisions in Editor phase).

See `.planning/research/PITFALLS.md` for full recovery strategies, integration gotchas, and the "looks done but isn't" checklist.

---

## Implications for Roadmap

The feature dependency graph and architecture build order align into six natural phases. The ordering is non-negotiable — each phase unblocks the next and the pitfall prevention strategy requires specific foundations before connecting AI.

### Phase 1: Foundation — Auth, Database Schema, Contractor Profile

**Rationale:** Every subsequent phase requires a user context (auth), a database schema (proposals, compliance_matrix_rows, jobs tables), and a contractor profile (required for non-generic AI output). Building auth and profile first also validates Supabase RLS before sensitive proposal documents are stored. This is the lowest-risk phase and establishes the scaffolding.

**Delivers:** Working auth flow, contractor profile editor, Supabase schema with RLS, Stripe billing integration (subscription check middleware), Next.js project structure per architecture spec.

**Addresses:** "Accounts & Billing" and "Contractor Profile" features from PROJECT.md.

**Avoids:** Supabase Storage RLS misconfiguration pitfall (test cross-user access before any files are stored); Stripe webhook idempotency pitfall (implement correctly from the start, not retrofitted).

**Research flag:** Standard patterns — well-documented Supabase Auth + Stripe subscription setup. Skip phase research.

---

### Phase 2: Document Ingestion — Upload, Parse, Job Queue

**Rationale:** Everything depends on clean RFP text. Architecture explicitly states: validate document parsing in isolation (test 10 real RFPs, verify text quality) before connecting Claude. The async job queue pattern must be established here — it is an architecture decision, not a feature. Prompt caching must also be designed here, before the first Claude call is written.

**Delivers:** File upload UI (react-dropzone + Supabase Storage), job queue (Supabase jobs table + pg_cron + Edge Function worker), PDF text extraction (pdf-parse with OCR fallback for scanned docs), DOCX extraction (mammoth), parse quality validation, job status polling via Supabase Realtime.

**Addresses:** "Document Ingestion" features from PROJECT.md.

**Avoids:** PDF parsing reliability pitfall (OCR fallback for scanned PDFs, quality badge, threshold detection); Claude API cost blowout pitfall (prompt caching architecture established here); blocking HTTP on long-running jobs anti-pattern (async job queue is the foundation).

**Research flag:** PDF OCR fallback needs research — Tesseract.js vs. AWS Textract vs. Google Document AI tradeoffs for government PDF quality. Flag for phase research.

---

### Phase 3: RFP Analysis — Compliance Matrix and Win Probability Score

**Rationale:** First Claude integration. With clean parsed text available from Phase 2, the structured extraction pipeline can be built and validated independently before proposal drafting. Compliance matrix must be correct before it can be linked to the editor. Win score uses Opus — the most expensive model — and must be validated for output quality and cost before enabling at scale.

**Delivers:** Claude structured output pipeline (Zod schemas for requirements, compliance rows, win score), compliance matrix UI (requirement checklist with mandatory/desired flagging), win probability score (0–100 with factor breakdown using claude-opus-4-6), RFP structure sidebar.

**Addresses:** "Compliance Matrix" and "Win Probability Score" features from PROJECT.md; "RFP structure sidebar" differentiator.

**Avoids:** Compliance matrix hallucination pitfall (grounding prompts with verbatim citations, two-pass extraction, UI citation display); one giant Claude prompt anti-pattern (separate calls per task from day one).

**Research flag:** Standard Claude structured output patterns are well-documented. Skip phase research. However, validate extraction accuracy with 3–5 real government RFPs (not synthetic test data) before advancing to Phase 4.

---

### Phase 4: Proposal Drafting — AI Sections and Streaming Editor

**Rationale:** Depends on Phase 2 (clean RFP text), Phase 3 (compliance matrix for context), and Phase 1 (contractor profile for injection). This is the highest-complexity phase — Tiptap integration, streaming AI responses, and compliance matrix live-linking must all work together. Build Tiptap first with static content, then add streaming, then link the compliance matrix.

**Delivers:** AI-drafted proposal sections (Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative) via streaming Claude API calls; Tiptap rich text editor with auto-save; section-level regeneration with custom instructions; compliance matrix live-linked to editor (coverage status); RFP sidebar visible during editing.

**Addresses:** "Proposal Drafting" and "In-Browser Rich Text Editor" features from PROJECT.md.

**Avoids:** Rich text editor complexity pitfall (Tiptap JSON storage, typed AI injection, paste sanitization, streaming insertion tested before Claude wiring); storing draft as HTML anti-pattern (Tiptap JSON from day one); streaming timeout pitfall (test 150k-token generation against Vercel timeout before shipping).

**Research flag:** Tiptap + streaming AI content injection is a well-documented pattern but has known edge cases. Flag for phase research specifically on: (1) streaming into Tiptap while preserving cursor position, and (2) compliance matrix live-linking implementation (client-side diff on editor update or server-side on save).

---

### Phase 5: Export Pipeline — Word and PDF

**Rationale:** Depends on Phase 4 establishing the Tiptap JSON data model. Export is a one-way serialization step — it reads the final DraftStore JSON and converts it. Building last is correct because the data model must be stable before writing the converter.

**Delivers:** Word export (.docx) via typed Tiptap-JSON-to-docx converter using `docx` library; PDF export via `@react-pdf/renderer` (not Puppeteer); auto-filename convention (`[contractor]-[solicitation]-[date].docx`); visual regression tests for export fidelity.

**Addresses:** "Export" features from PROJECT.md.

**Avoids:** Word/PDF export fidelity pitfall (typed converter, not html-docx-js; @react-pdf/renderer, not Puppeteer; visual regression tests on Windows Word); Vercel serverless binary size limit (no Chromium on Vercel).

**Research flag:** Standard patterns for both `docx` and `@react-pdf/renderer` are well-documented. Skip phase research. Build visual regression tests against Word on Windows — this is the common failure mode.

---

### Phase 6: Post-Validation Differentiators — L/M Crosswalk, Past Performance, Gap Highlighting

**Rationale:** These features build on the validated core workflow (Phases 1–5). They require paying users to confirm the base product works before adding complexity. Section L/M crosswalk requires the compliance matrix to be trusted. Past performance auto-narrative requires the contractor profile schema to be in production use. Real-time compliance gap highlighting requires the editor integration from Phase 4 to be stable.

**Delivers:** Section L/M cross-reference crosswalk table (automatic L-to-M mapping); past performance auto-narrative tailored to current RFP scope; real-time compliance gap highlighting in editor (surfacing uncovered requirements while editing); small business set-aside cert matching notifications.

**Addresses:** All v1.x features from FEATURES.md.

**Avoids:** Over-engineering before product-market fit; building collaboration features (correctly deferred to v2+).

**Research flag:** Past performance auto-narrative needs research on the structured past project schema — specifically what fields drive the highest quality tailored narratives.

---

### Phase Ordering Rationale

- **Dependencies drive order:** Profile before AI drafting (profile data required in prompts), parse pipeline before extraction (clean text required for Claude), compliance matrix before editor live-linking, editor before export (Tiptap JSON is the source of truth).
- **Pitfall prevention drives priority:** Prompt caching and OCR fallback must be in Phase 2 (ingest architecture), not retrofitted. Compliance hallucination prevention must be in Phase 3, not patched post-launch.
- **Validation gates between phases:** Test parse quality with real government RFPs before Phase 3. Validate compliance matrix accuracy before Phase 4. Validate editor stability before Phase 5. Do not advance phases on synthetic test data.
- **Billing before first real user:** Stripe subscription enforcement in middleware from Phase 1 — never in a separate billing phase added later.

### Research Flags

**Needs deeper research before planning:**
- **Phase 2 (Document Ingestion):** OCR fallback strategy — Tesseract.js vs. AWS Textract vs. Google Document AI for government PDF quality and table structure accuracy. This decision has cost and accuracy tradeoffs not fully resolved in current research.
- **Phase 4 (Editor + Drafting):** Tiptap streaming AI injection edge cases — cursor behavior during streaming, ProseMirror transaction handling for AI-generated content, and the implementation approach for compliance matrix live-linking (client-side vs. server-side diff).
- **Phase 6 (Post-Validation):** Past performance auto-narrative schema — which structured fields (contract value, scope, agency, period, outcome, NAICS) produce the highest quality tailored narrative output; requires testing against real HCC member past project data.

**Standard patterns (skip phase research):**
- **Phase 1 (Foundation):** Supabase Auth + Stripe subscription setup is exhaustively documented; standard Next.js 15 + Supabase + Stripe pattern.
- **Phase 3 (Compliance Matrix):** Claude structured outputs with Zod schemas is a well-documented official pattern; architecture research provides complete code examples.
- **Phase 5 (Export):** `docx` library and `@react-pdf/renderer` are well-documented; primary risk is integration testing, not research.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core libraries verified against npm registry and official docs; version compatibility table confirmed; Tiptap vs. Lexical comparison is MEDIUM (single Liveblocks blog source) but recommendation is conservative (Tiptap v2, not v3) |
| Features | MEDIUM-HIGH | Table stakes and differentiators confirmed via 5+ competitor sources; pWin score methodology verified via CLEATUS and Procurement Sciences; some competitor pages inaccessible during research |
| Architecture | HIGH | Async job queue, streaming, and structured output patterns verified against official Supabase, Vercel AI SDK, and Anthropic docs; data flow confirmed against official Claude legal summarization guide |
| Pitfalls | HIGH | All major pitfalls verified against official documentation or 3+ independent sources; PDF parsing benchmarks from arXiv and Applied AI; Stripe pitfalls from official Stripe docs + 2 community sources |

**Overall confidence:** HIGH

### Gaps to Address

- **OCR fallback for scanned PDFs:** Research identified the problem and general approaches (Tesseract, Textract, Document AI) but did not benchmark quality vs. cost for government RFP-specific documents with complex table structures. Validate during Phase 2 planning with real government PDFs.

- **Tiptap streaming injection implementation:** Research confirms Tiptap is the right choice and `insertContentAt` is the right API, but the exact ProseMirror transaction pattern for streaming token-by-token insertion without cursor disruption requires a proof-of-concept during Phase 4 planning.

- **Per-user token budget UX:** Research confirms the need for per-user monthly token caps, but the UX design (usage indicator, hard cutoff vs. soft warning, what counts toward limits) needs product decision during Phase 1/billing planning.

- **Anthropic zero-retention settings:** PITFALLS.md flags that contractor proposal content should not be logged by the AI provider. The specific Anthropic API settings and contractual requirements for zero-retention need verification against the current Anthropic API terms before launch.

- **GovRFP integration touchpoint:** PROJECT.md notes ProposalAI and GovRFP are complementary products. The deep-link pattern (GovRFP opportunity → ProposalAI upload flow) is deferred to v2+ but the data handoff format should be designed during Phase 1 to avoid retrofit work.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Platform Docs — PDF Support](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) — PDF limits, Files API pattern, prompt caching
- [Anthropic Platform Docs — Files API](https://platform.claude.com/docs/en/build-with-claude/files) — 500MB file limit, beta header requirement
- [Anthropic Platform Docs — Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — schema patterns, batch extraction
- [Anthropic Platform Docs — Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — cost calculations for pitfall analysis
- [Vercel AI SDK — Next.js App Router Getting Started](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — streaming pattern
- [Supabase Processing Large Jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — job queue pattern
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — RLS on storage
- [Next.js 15 official release notes](https://nextjs.org/blog/next-15) — version and caching behavior changes
- [Tiptap Next.js integration docs](https://tiptap.dev/docs/editor/getting-started/install/nextjs) — editor integration patterns
- [Stripe webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — subscription lifecycle events
- [docx npm library](https://github.com/dolanmiu/docx) — v9.6.1 active maintenance confirmed
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.3 current
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.80.0 current

### Secondary (MEDIUM confidence)
- [PDF Data Extraction Benchmark 2025 — Procycons](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/) — parser accuracy comparison
- [State of PDF Parsing — Applied AI](https://www.applied-ai.com/briefings/pdf-parsing-benchmark/) — table extraction quality
- [Benchmarking PDF Parsers on Table Extraction — arXiv 2025](https://arxiv.org/html/2603.18652v1) — Docling 100% text fidelity claim
- [Four AI Risks in Proposal Writing — Lohfeld Consulting 2025](https://lohfeldconsulting.com/blog/2025/12/how-to-overcome-four-ai-risks-in-proposal-writing-now/) — hallucination and compliance risks
- [Which rich text editor in 2025 — Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) — Tiptap vs. Lexical comparison
- [Stripe webhook best practices — Stigg](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — idempotency and event handling
- [CLEATUS blog: How to Calculate PWin](https://lohfeldconsulting.com) — pWin score methodology
- [GovEagle: AI Proposal Writing Tools for Government Contractors](https://www.goveagle.com/blog/ai-proposal-writing-tools-government-contractors) — GovDash and competitor features
- [Arphie.ai: Top 30 RFP Proposal Software in 2026](https://arphie.ai) — feature landscape analysis
- [HSVAGI: RFP Response Automation: Compliance Matrix Requirements](https://hsvagi.com) — Section L/M parsing, 97% accuracy claim
- [Stripe + Next.js 15 complete guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — Server Actions billing pattern

### Tertiary (LOW confidence — vendor claims, needs independent validation)
- AutogenAI Federal: "30% increase in win rates" — single-source vendor claim; not used in feature recommendations
- AutogenAI Federal: "5-minute first draft, 70% faster" — vendor benchmark; useful as aspirational target only

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
