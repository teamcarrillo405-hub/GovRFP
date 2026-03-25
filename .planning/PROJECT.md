# HCC ProposalAI

## What This Is

HCC ProposalAI is a standalone SaaS platform that helps contractors win more government contracts by turning raw RFPs into structured, compliant proposal drafts using Claude AI. Contractors upload an RFP (PDF or Word, including scanned PDFs via AWS Textract OCR), and the system returns a compliance matrix, AI-drafted proposal sections, a win probability score, and an in-browser rich-text editor — then exports a polished Word or PDF document ready for submission.

**Shipped v1.1** — full end-to-end flow plus RFP structure sidebar with click-to-scroll navigation and active section highlighting.

## Core Value

Reduce the time from RFP receipt to first draft from days to under 30 minutes, with compliance gaps surfaced automatically so nothing is missed.

## Requirements

### Validated (v1.0 + v1.1)

- ✓ Upload RFP as PDF or Word (.docx) with OCR fallback for scanned PDFs — v1.0
- ✓ AI extraction of requirements, deadlines, evaluation criteria (3 sequential Claude calls with prompt caching) — v1.0
- ✓ Auto-generate compliance matrix with mandatory/desired flags — v1.0
- ✓ Win probability score (0–100) with factor breakdown (hybrid Claude + computed scoring) — v1.0
- ✓ AI-drafted sections: Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative — v1.0
- ✓ Contractor profile injection into drafts (certifications, NAICS codes, past projects, team bios) — v1.0
- ✓ Section-by-section regeneration with custom instructions — v1.0
- ✓ In-browser Tiptap editor with compliance live-link and 30s auto-save — v1.0
- ✓ Export to Word (.docx) preserving heading styles, lists, tables — v1.0
- ✓ Export to PDF (Letter size, Helvetica, consistent layout) — v1.0
- ✓ Contractor profile (certifications, NAICS, past projects, key personnel bios) — v1.0
- ✓ Per-seat/month subscription with 14-day no-card trial (Stripe) — v1.0
- ✓ RFP structure sidebar — collapsible panel showing parsed sections + requirements, click-to-scroll, active section highlight — v1.1

### Active (v2.0 candidates)

<!-- Next milestone — derived from v1.1 Out of Scope + known gaps -->

**Collaboration**
- [ ] Multi-user team accounts — invite teammates to a proposal, role-based access (owner / editor / viewer)
- [ ] Real-time co-editing indicators (presence awareness)

**Integrations**
- [ ] RFP discovery import — one-click import from GovRFP (`contractor-rfp-website`) into ProposalAI
- [ ] SAM.gov entity data prefill — pull contractor certifications from SAM registration

**Editor Enhancements**
- [ ] Version history — compare drafts, restore previous version
- [ ] Comments / annotation on proposal sections

**Analytics & Feedback**
- [ ] Win/loss tracking — log bid outcomes, feed back into win score model
- [ ] Usage dashboard for HCC operators — active users, proposals drafted, export volume

### Out of Scope (v2.0+)

- Direct submission to SAM.gov / agency portals — legal complexity, agency-specific formats
- Custom AI model fine-tuning — Claude API with prompt engineering is sufficient; fine-tuning adds cost without clear upside at current scale
- Freemium tier — per-seat + trial is validated; freemium adds support cost without revenue

## Context

- HCC (Hispanic Contractors California) is the operator — initial user base is HCC member contractors, with broader market expansion planned
- The GovRFP product (`contractor-rfp-website`) handles RFP discovery; ProposalAI is the response side — v2 integration between the two is the highest-value next step
- Target users are small-to-mid-size government contractors who manually write proposals today, often losing bids due to missed compliance items
- **Actual stack shipped:** Next.js 16.2.1 + React 19 + Supabase (@supabase/ssr) + Stripe v20 + Claude API (sonnet-4-6) + Tiptap v2 + docx@9.6.1 + @react-pdf/renderer@4.3.2
- 6,025 lines of TypeScript/TSX, 180 tests, 202 files

## Constraints

- **AI**: Claude API only — not OpenAI or other providers; `claude-sonnet-4-6` for draft streaming + analysis Edge Functions
- **Pricing**: Per-seat SaaS — no freemium in v2 either (validated constraint)
- **Stack**: Next.js + Supabase (consistent with GovRFP investment and HCC brand stack) — locked through v2
- **Solo accounts**: v1.0 is solo only; v2.0 adds team accounts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude API as AI engine | Long context window handles full RFPs; HCC already uses Anthropic products | ✓ Good — 1M token window eliminated chunking complexity |
| Separate product from GovRFP | Different user workflow (find vs. respond); separate billing, separate deployment | ✓ Good — but v2 integration path is the highest-value next step |
| Rich text editor in-browser (Tiptap) | Contractors need to edit AI output without downloading; reduces round-trips | ✓ Good — Tiptap v2 stable, custom ComplianceGapMark worked cleanly |
| Per-seat pricing with 14-day no-card trial | Aligns with contractor budgeting norms; simple billing model | ✓ Good — Stripe trial mechanics require all 3 params together |
| Solo account MVP | Reduces auth/permissions complexity; validates core product before team features | ✓ Good — now primary v2 feature request |
| OCR via AWS Textract (not Tesseract.js) | 85MB wasm OOM risk on Edge Functions; Textract 99%+ accuracy | ✓ Good — avoids OOM, clean API |
| Async job queue in Postgres (not Inngest) | Avoids double-trigger footgun with storage.objects; pg_cron is sufficient for current scale | ✓ Good — simpler ops, no external service dependency |
| docx npm (not Puppeteer) for Word export | Vercel 50MB bundle limit rules out headless Chrome | ✓ Good — docx@9.6.1 handles all Tiptap node types cleanly |
| @react-pdf/renderer for PDF (not Puppeteer) | Same bundle size constraint | ✓ Good — requires `serverExternalPackages` + `runtime = 'nodejs'` (documented) |
| Buffer pattern for streaming drafts | `setContent()` called once on stream completion, not per chunk | ✓ Good — avoids Tiptap cursor jump on partial content |

## Current Milestone: v2.0 Collaboration + Integrations

**Goal:** Expand ProposalAI from solo tool to team-capable platform with cross-product GovRFP integration and operator analytics.

**Target features:**
- Multi-user team accounts (invite teammates, RBAC: owner / editor / viewer)
- Real-time co-editing presence indicators
- GovRFP one-click RFP import (contractor-rfp-website → ProposalAI)
- SAM.gov entity data prefill for contractor certifications
- Version history (compare drafts, restore previous)
- Section comments / annotation
- Win/loss tracking (bid outcomes feed back into win score model)
- HCC operator dashboard (active users, proposals drafted, export volume)

## Current State

**v1.1 shipped — full solo flow + RFP structure sidebar complete.**

- 6 phases complete | 24 plans | 35 E2E tests + 180 unit tests passing
- Full RFP → draft → export flow with sidebar navigation
- v2.0 in progress: team accounts, GovRFP integration, SAM.gov prefill, version history, comments, win/loss tracking, operator dashboard

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 — v2.0 milestone started*
