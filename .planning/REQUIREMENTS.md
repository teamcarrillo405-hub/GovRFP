# HCC ProposalAI — v1 Requirements

**Defined:** 2026-03-23
**Status:** Active

---

## v1 Requirements

### Document Ingestion

- [x] **INGEST-01**: User can upload an RFP as a PDF file (up to 50MB)
- [x] **INGEST-02**: User can upload an RFP as a Word (.docx) file (up to 50MB)
- [x] **INGEST-03**: System detects when a PDF is image-only (scanned) and routes it through OCR fallback automatically
- [x] **INGEST-04**: RFP processing (parse + extraction) runs as a background job; user sees progress indicator and is notified when processing completes
- [ ] **INGEST-05**: User can view the parsed RFP structure (section outline + requirement list) in a sidebar while editing their proposal

### AI Analysis

- [ ] **ANALYZE-01**: System extracts individual requirements from the RFP (shall/must/will statements, Section L instructions) and classifies each as mandatory or desired
- [ ] **ANALYZE-02**: System generates a compliance matrix mapping each extracted requirement to a proposal section with initial coverage status (addressed / unaddressed)
- [ ] **ANALYZE-03**: System generates a win probability score (0–100) with a reasoning breakdown covering: scope alignment, certifications match, set-aside match, past performance relevance, competition level
- [ ] **ANALYZE-04**: System detects set-aside preferences in the RFP (e.g., 8(a), HUBZone, SDVOSB) and flags when they match the contractor's certifications profile
- [ ] **ANALYZE-05**: System generates a Section L/M crosswalk table mapping each Section L instruction to the corresponding Section M evaluation criterion

### Contractor Profile

- [x] **PROFILE-01**: User can create and edit a contractor profile with: company name, UEI/CAGE, business certifications (8(a), HUBZone, SDVOSB, WOSB, SDB), and NAICS codes
- [x] **PROFILE-02**: User can add, edit, and delete past project records with fields: contract number, agency, contract value, period of performance, scope narrative, NAICS code, outcome
- [x] **PROFILE-03**: User can add, edit, and delete key personnel records with fields: name, title, relevant experience narrative, certifications
- [x] **PROFILE-04**: User can write a capability statement narrative (free-form text up to 2000 characters) that is automatically injected into AI-generated proposal sections

### Authentication & Accounts

- [x] **AUTH-01**: User can create an account with email and password
- [x] **AUTH-02**: User receives an email verification link after sign-up and must verify before accessing the product
- [x] **AUTH-03**: User can log in with email and password and remain logged in across browser sessions
- [x] **AUTH-04**: User can request a password reset via email
- [x] **AUTH-05**: User's proposals, documents, and profile data are isolated to their account via row-level security; no cross-account data access is possible

### Billing

- [x] **BILLING-01**: User can start a 14-day free trial without entering payment information
- [x] **BILLING-02**: User can subscribe with a credit card via Stripe Checkout at the end of the trial or at any time
- [x] **BILLING-03**: User loses access to AI features and new proposal creation when subscription is canceled or payment fails; existing proposals remain viewable (read-only)
- [x] **BILLING-04**: User can view their current subscription status and next billing date in account settings
- [x] **BILLING-05**: User can cancel their subscription at any time from account settings

### AI Proposal Drafting

- [ ] **DRAFT-01**: System generates a complete Executive Summary section tailored to the RFP scope and the contractor's profile (certifications, capability statement, past performance)
- [ ] **DRAFT-02**: System generates a complete Technical Approach section based on the RFP's technical requirements and the contractor's relevant past performance
- [ ] **DRAFT-03**: System generates a complete Management Plan section including key personnel bios injected from the contractor profile
- [ ] **DRAFT-04**: System generates a complete Past Performance section with narrative descriptions drawn from the contractor's past project records, matched to the RFP scope
- [ ] **DRAFT-05**: System generates a Price Narrative section framing the contractor's approach to pricing (narrative only; no actual numbers generated)
- [ ] **DRAFT-06**: User can regenerate any individual proposal section with optional natural-language instructions (e.g., "focus more on cybersecurity certifications")

### Editor

- [ ] **EDITOR-01**: User can edit all proposal sections in a rich text editor supporting headings, bullet lists, numbered lists, bold, italic, underline, and tables
- [ ] **EDITOR-02**: Editor auto-saves content every 30 seconds; user sees a "saved" timestamp indicator
- [ ] **EDITOR-03**: Compliance matrix is displayed alongside the editor and updates coverage status as the user edits (a requirement is marked addressed when its key terms appear in the relevant section)
- [ ] **EDITOR-04**: Editor visually highlights text regions where compliance requirements are not yet addressed, enabling the user to identify gaps without leaving the editor

### Export

- [ ] **EXPORT-01**: User can export the complete proposal as a Word (.docx) file with proper heading styles (Heading 1, Heading 2), paragraph formatting, and table structure preserved
- [ ] **EXPORT-02**: User can export the complete proposal as a PDF file suitable for internal review and distribution

---

## v2 Requirements (Deferred)

These features are confirmed valuable but deferred to allow validation of the core solo workflow first.

- **FUTURE-01**: Past performance auto-narrative — AI tailors each past project description to the current RFP's evaluation criteria (requires stable past project schema from PROFILE-02)
- **FUTURE-02**: RFP structure sidebar during editing — parsed RFP outline visible in collapsible sidebar panel
- **FUTURE-03**: Multi-user team collaboration — role-based access, section ownership, conflict resolution (adds significant auth/permissions complexity)
- **FUTURE-04**: Version history with diff view — tracked changes and version comparison for solo users
- **FUTURE-05**: GovRFP deep-link integration — one-click "respond to this RFP" from GovRFP into ProposalAI
- **FUTURE-06**: Agency-specific template libraries — curated formatting for common agency submission portals
- **FUTURE-07**: Email/CRM integrations — Salesforce, HubSpot connectors for enterprise BD teams

---

## Out of Scope

These are explicitly excluded from the product. Reasoning is preserved to prevent re-introduction.

| Feature | Why Excluded |
|---------|--------------|
| Direct portal submission (SAM.gov, PIEE) | Each portal has different auth, form schemas, and file requirements; legal liability if submission fails; portals change without notice |
| RFP discovery / opportunity search | Separate product (GovRFP handles this); complicates pricing and user flow |
| Real-time collaborative editing (Google Docs-style) | Requires OT/CRDT infrastructure; not needed for solo MVP |
| Custom AI model fine-tuning | Claude API long-context handles this via in-context injection; fine-tuning offers diminishing returns |
| Freemium / free tier | Attracts non-serious users, inflates cost; per-seat + 14-day trial is better fit for B2B GovCon |
| Automated pricing / price volume generation | AI errors in pricing create legal and financial exposure |
| Email/CRM integration | Not needed by small contractors who are the target market |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 — Foundation | Complete |
| AUTH-02 | Phase 1 — Foundation | Complete |
| AUTH-03 | Phase 1 — Foundation | Complete |
| AUTH-04 | Phase 1 — Foundation | Complete |
| AUTH-05 | Phase 1 — Foundation | Complete |
| BILLING-01 | Phase 1 — Foundation | Complete |
| BILLING-02 | Phase 1 — Foundation | Complete |
| BILLING-03 | Phase 1 — Foundation | Complete |
| BILLING-04 | Phase 1 — Foundation | Complete |
| BILLING-05 | Phase 1 — Foundation | Complete |
| PROFILE-01 | Phase 1 — Foundation | Complete |
| PROFILE-02 | Phase 1 — Foundation | Complete |
| PROFILE-03 | Phase 1 — Foundation | Complete |
| PROFILE-04 | Phase 1 — Foundation | Complete |
| INGEST-01 | Phase 2 — Document Ingestion | Complete |
| INGEST-02 | Phase 2 — Document Ingestion | Complete |
| INGEST-03 | Phase 2 — Document Ingestion | Complete |
| INGEST-04 | Phase 2 — Document Ingestion | Complete |
| INGEST-05 | Phase 2 — Document Ingestion | Pending |
| ANALYZE-01 | Phase 3 — RFP Analysis | Pending |
| ANALYZE-02 | Phase 3 — RFP Analysis | Pending |
| ANALYZE-03 | Phase 3 — RFP Analysis | Pending |
| ANALYZE-04 | Phase 3 — RFP Analysis | Pending |
| ANALYZE-05 | Phase 3 — RFP Analysis | Pending |
| DRAFT-01 | Phase 4 — Proposal Drafting + Editor | Pending |
| DRAFT-02 | Phase 4 — Proposal Drafting + Editor | Pending |
| DRAFT-03 | Phase 4 — Proposal Drafting + Editor | Pending |
| DRAFT-04 | Phase 4 — Proposal Drafting + Editor | Pending |
| DRAFT-05 | Phase 4 — Proposal Drafting + Editor | Pending |
| DRAFT-06 | Phase 4 — Proposal Drafting + Editor | Pending |
| EDITOR-01 | Phase 4 — Proposal Drafting + Editor | Pending |
| EDITOR-02 | Phase 4 — Proposal Drafting + Editor | Pending |
| EDITOR-03 | Phase 4 — Proposal Drafting + Editor | Pending |
| EDITOR-04 | Phase 4 — Proposal Drafting + Editor | Pending |
| EXPORT-01 | Phase 5 — Export Pipeline | Pending |
| EXPORT-02 | Phase 5 — Export Pipeline | Pending |
