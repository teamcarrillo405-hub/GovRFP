# HCC ProposalAI

## What This Is

HCC ProposalAI is a standalone SaaS platform that helps contractors win more government contracts by turning raw RFPs into structured, compliant proposal drafts using Claude AI. Contractors upload an RFP (PDF or Word), and the system returns a compliance matrix, AI-drafted proposal sections, a win probability score, and an in-browser rich-text editor — then exports a polished Word or PDF document ready for submission.

## Core Value

Reduce the time from RFP receipt to first draft from days to under 30 minutes, with compliance gaps surfaced automatically so nothing is missed.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**All 5 phases shipped and verified — HCC ProposalAI v1.0 complete**

- [x] Upload RFP as PDF or Word (.docx) — Validated in Phase 2
- [x] AI extraction of requirements, deadlines, evaluation criteria — Validated in Phase 3
- [x] Auto-generate compliance matrix with mandatory/desired flags — Validated in Phase 3
- [x] Win probability score (0–100) with factor breakdown — Validated in Phase 3
- [x] AI-drafted proposal sections (all 5) with contractor profile injection — Validated in Phase 4
- [x] Section-by-section regeneration with custom instructions — Validated in Phase 4
- [x] In-browser rich text editor with compliance live-link and auto-save — Validated in Phase 4
- [x] Export to Word (.docx) preserving heading styles, lists, tables — Validated in Phase 5
- [x] Export to PDF (Letter size, Helvetica, consistent layout) — Validated in Phase 5
- [x] Contractor profile (certifications, NAICS, past projects, team bios) — Validated in Phase 1
- [x] Per-seat/month subscription with 14-day no-card trial (Stripe) — Validated in Phase 1

### Active

<!-- Current scope. Building toward these. -->

**Document Ingestion**
- [ ] Upload RFP as PDF or Word (.docx)
- [ ] AI extraction of requirements, deadlines, evaluation criteria, and submission instructions
- [ ] Display parsed RFP structure in sidebar for reference during editing

**Compliance Matrix**
- [ ] Auto-generate requirement-by-requirement compliance checklist
- [ ] Flag mandatory vs. desired requirements
- [ ] Mark each requirement as addressed / partially addressed / missing in the draft

**Proposal Drafting**
- [ ] AI-drafted sections: Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative
- [ ] Contractor profile data injected into drafts (certifications, NAICS codes, past projects, team bios)
- [ ] Section-by-section regeneration with custom instructions

**Win Probability Score**
- [ ] AI-generated win score (0–100) with reasoning breakdown
- [ ] Score factors: scope alignment, past performance match, certifications match, competition level

**In-Browser Rich Text Editor**
- [ ] Full editing of all draft sections
- [ ] Compliance matrix live-linked to editor (highlight missing items)
- [ ] Auto-save

**Export**
- [ ] Export to Word (.docx) preserving formatting
- [ ] Export to PDF

**Contractor Profile**
- [ ] Structured profile: company certifications (8(a), HUBZone, SDVOSB, etc.), NAICS codes, capability statement, past projects, key personnel bios
- [ ] Profile data automatically pulled into AI drafts

**Accounts & Billing**
- [ ] Per-seat/month subscription (Stripe)
- [ ] Solo account (one user per subscription to start)
- [ ] Secure document storage per account

### Out of Scope

- Multi-user team collaboration — not in MVP (solo account only)
- RFP discovery / search — separate product (GovRFP handles this)
- Direct submission to SAM.gov or portals — too complex for MVP, legal risk
- Custom AI model training — use Claude API with prompt engineering instead

## Context

- HCC (Hispanic Contractors California) is the operator — tool will be used by HCC member contractors and marketed to the broader contractor community
- The GovRFP product (`contractor-rfp-website`) handles RFP discovery; ProposalAI is the response side — these are complementary but separate products
- Target users are small-to-mid-size government contractors who manually write proposals today, often losing bids due to missed compliance items
- Claude API (Anthropic) is the AI engine — long context window handles full RFP PDFs
- Stack expectation: Next.js 14 App Router + Supabase + Stripe + Claude API

## Constraints

- **AI**: Claude API only — not OpenAI or other providers; long context (claude-opus-4-6 or claude-sonnet-4-6 depending on task)
- **Pricing**: Per-seat SaaS — no one-time purchase, no freemium in MVP
- **MVP scope**: Full v1 with all listed features — no phased feature rollout
- **Users**: Solo accounts only in MVP — no team/org multi-seat yet
- **Stack**: Next.js + Supabase (consistent with GovRFP investment and HCC brand stack)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude API as AI engine | Long context window handles full RFPs; HCC already uses Anthropic products | — Pending |
| Separate product from GovRFP | Different user workflow (find vs. respond); separate billing, separate deployment | — Pending |
| Rich text editor in-browser | Contractors need to edit AI output without downloading; reduces round-trips | — Pending |
| Per-seat pricing | Aligns with contractor budgeting norms; simple billing model | — Pending |
| Solo account MVP | Reduces auth/permissions complexity; validates core product before team features | — Pending |

## Current State

**v1.0 complete — all 5 phases shipped.** 180 tests passing. Ready for production deployment.

- Phase 1: Foundation (Auth + Billing + Profile) — Complete 2026-03-23
- Phase 2: Document Ingestion (Upload + OCR + Async Parse) — Complete 2026-03-23
- Phase 3: RFP Analysis (Claude extraction + Compliance Matrix + Win Score) — Complete 2026-03-23
- Phase 4: Proposal Drafting + Editor (Streaming AI + Tiptap + Compliance live-link) — Complete 2026-03-24
- Phase 5: Export Pipeline (Word .docx + PDF) — Complete 2026-03-24

---
*Last updated: 2026-03-24 after Phase 5 completion — v1.0 milestone*
