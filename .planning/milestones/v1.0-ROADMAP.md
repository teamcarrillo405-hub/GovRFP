# Roadmap: HCC ProposalAI

## Overview

HCC ProposalAI goes from zero to a full AI-assisted RFP proposal writing SaaS in five phases. Phase 1 builds the foundation — auth, billing enforcement, contractor profile, and the full Supabase schema — because every AI feature requires a user context and a profile to inject. Phase 2 establishes the document ingestion pipeline with async job queue and OCR fallback before any Claude call is written. Phase 3 adds the first Claude integration: structured RFP extraction, compliance matrix, and win probability score. Phase 4 is the core product experience: streaming AI drafts injected into the Tiptap rich text editor with live compliance linking. Phase 5 completes the submission workflow with Word and PDF export. The result is a contractor who uploads an RFP and has a submission-ready proposal in under 30 minutes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, billing enforcement, contractor profile, and full database schema (completed 2026-03-23)
- [x] **Phase 2: Document Ingestion** - RFP upload, async parse pipeline, OCR fallback, and job queue (completed 2026-03-23)
- [ ] **Phase 3: RFP Analysis** - Claude structured extraction, compliance matrix, and win probability score
- [ ] **Phase 4: Proposal Drafting + Editor** - Streaming AI drafts, Tiptap editor, compliance live-linking
- [ ] **Phase 5: Export Pipeline** - Word (.docx) and PDF export from Tiptap JSON

## Phase Details

### Phase 1: Foundation
**Goal**: Contractors can create accounts, subscribe, and build a complete profile so every subsequent AI feature has user context and contractor data to draw from
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, BILLING-01, BILLING-02, BILLING-03, BILLING-04, BILLING-05, PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password, verify via email link, log in, stay logged in across sessions, and reset a forgotten password
  2. User can start a 14-day free trial without a credit card, then subscribe via Stripe Checkout, view their subscription status, and cancel at any time from account settings
  3. User loses access to AI features and new proposal creation when subscription lapses; existing proposals remain viewable read-only
  4. User can create and edit a contractor profile with certifications (8(a)/HUBZone/SDVOSB/WOSB/SDB), NAICS codes, past projects (with full contract details), key personnel bios, and a capability statement narrative
  5. Each user's data (proposals, documents, profile) is fully isolated — no cross-account access is possible via row-level security
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 16, install deps, DB schema, Supabase/Stripe clients, test infra
- [x] 01-02-PLAN.md — Auth flow: signup, email verification (PKCE), login, password reset, proxy.ts
- [x] 01-03-PLAN.md — Billing: Stripe checkout with trial, webhooks, Customer Portal, subscription gating
- [x] 01-04-PLAN.md — Profile: company info, certifications, NAICS, past projects, key personnel, capability statement
- [x] 01-05-PLAN.md — Tests: RLS isolation, billing gating, profile validation, auth verification

**UI hint**: yes

### Phase 2: Document Ingestion
**Goal**: Contractors can upload any government RFP (PDF or Word, including scanned PDFs) and the system reliably extracts clean text via an async background job with real-time status feedback
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF (up to 50MB) or Word (.docx) RFP file and receive immediate confirmation while processing runs in the background
  2. User sees a progress indicator during processing and is notified (via UI update) when the RFP is ready — no manual refresh required
  3. When a scanned (image-only) PDF is uploaded, the system automatically routes it through OCR and returns extracted text without user intervention
  4. User can view the parsed RFP structure — section outline and requirement list — in a sidebar while working on their proposal
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Install packages, DB migration (document_jobs + proposals extension), test stubs + fixtures
- [x] 02-02-PLAN.md — Core parsing library: PDF (unpdf), DOCX (mammoth), Textract OCR, RFP structure extraction
- [x] 02-03-PLAN.md — Upload API route (signed URL + job queue) + Supabase Edge Function (background processor)
- [x] 02-04-PLAN.md — Upload UI (drag-and-drop), real-time processing status, proposal pages, dashboard update

**UI hint**: yes

### Phase 3: RFP Analysis
**Goal**: After an RFP is parsed, contractors see a compliance matrix with every extracted requirement classified and a win probability score with reasoned factor breakdown — all grounded verbatim in the source document
**Depends on**: Phase 2
**Requirements**: ANALYZE-01, ANALYZE-02, ANALYZE-03, ANALYZE-04, ANALYZE-05
**Success Criteria** (what must be TRUE):
  1. System extracts every shall/must/will statement from the uploaded RFP and classifies each as mandatory or desired, with a verbatim source citation (section and page) visible in the UI
  2. User sees a compliance matrix mapping each extracted requirement to a proposal section, with initial coverage status (addressed / unaddressed) and mandatory/desired flags
  3. User receives a win probability score (0-100) with reasoning breakdown across: scope alignment, certifications match, set-aside match, past performance relevance, and competition level
  4. System detects set-aside preferences in the RFP and displays a visible flag when they match the contractor's certifications profile
  5. User can view a Section L/M crosswalk table showing which Section L instruction maps to which Section M evaluation criterion
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — DB migration (rfp_analysis table + job queue extension), TypeScript types, test stubs, Anthropic SDK devDep
- [x] 03-02-PLAN.md — Pure utility library: set-aside detector, Section L/M detector, win score computation + tests
- [x] 03-03-PLAN.md — analyze-proposal Edge Function (3 Claude calls with caching) + process-documents enqueue update
- [x] 03-04-PLAN.md — Analysis UI: ComplianceMatrix, WinScoreCard, SetAsideFlags, SectionLMCrosswalk + analysis page

**UI hint**: yes

### Phase 4: Proposal Drafting + Editor
**Goal**: Contractors can generate AI-drafted proposal sections tailored to their profile, edit them in a full-featured browser editor, regenerate individual sections with custom instructions, and see compliance gaps highlighted in real time
**Depends on**: Phase 3
**Requirements**: DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06, EDITOR-01, EDITOR-02, EDITOR-03, EDITOR-04
**Success Criteria** (what must be TRUE):
  1. User can generate all five proposal sections (Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative) with contractor profile data — certifications, capability statement, past projects, key personnel — injected automatically
  2. User can edit all generated sections in a rich text editor supporting headings, bullet lists, numbered lists, bold, italic, underline, and tables; edits auto-save every 30 seconds with a visible timestamp
  3. User can regenerate any individual section with optional natural-language instructions (e.g., "focus more on cybersecurity certifications") and see the new draft streamed in
  4. Compliance matrix updates coverage status as the user edits and visually highlights text regions where requirements are not yet addressed
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Install Tiptap v2 packages, DB migration (proposal_sections), shared types, test stubs
- [x] 04-02-PLAN.md — Draft streaming API route + per-section prompt builders with profile injection
- [x] 04-03-PLAN.md — Tiptap extension array, ComplianceGap mark, compliance scanner
- [x] 04-04-PLAN.md — Editor page: ProposalEditor, SectionEditor, EditorToolbar, CompliancePanel, RegenerateDialog, auto-save
- [x] 04-05-PLAN.md — Navigation wiring + human verification of complete editor flow

**UI hint**: yes

### Phase 5: Export Pipeline
**Goal**: Contractors can export a complete, formatted proposal as Word or PDF — preserving heading structure, tables, and formatting — ready for submission or internal review
**Depends on**: Phase 4
**Requirements**: EXPORT-01, EXPORT-02
**Success Criteria** (what must be TRUE):
  1. User can export the complete proposal as a Word (.docx) file with Heading 1/Heading 2 styles, paragraph formatting, and table structure preserved and compatible with Microsoft Word on Windows
  2. User can export the complete proposal as a PDF file suitable for internal review, with fonts and layout consistent across environments
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Install docx + @react-pdf/renderer, next.config.ts serverExternalPackages, Wave 0 test stubs
- [x] 05-02-PLAN.md — Tiptap-to-docx converter + Word export API route (EXPORT-01)
- [x] 05-03-PLAN.md — Tiptap-to-pdf converter + PDF export API route (EXPORT-02)
- [ ] 05-04-PLAN.md — ExportButtons UI component + editor page integration + human verification

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete   | 2026-03-23 |
| 2. Document Ingestion | 4/4 | Complete   | 2026-03-23 |
| 3. RFP Analysis | 4/4 | Complete   | 2026-03-23 |
| 4. Proposal Drafting + Editor | 5/5 | Complete   | 2026-03-24 |
| 5. Export Pipeline | 3/4 | In Progress|  |
