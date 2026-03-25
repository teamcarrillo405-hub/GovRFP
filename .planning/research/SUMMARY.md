# Project Research Summary

**Project:** HCC ProposalAI v2.0 — Team Collaboration, Integrations, Analytics
**Domain:** B2B SaaS — AI-assisted government proposal writing
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

HCC ProposalAI v2.0 adds 8 capabilities on top of a proven v1.x foundation (Next.js 16, Supabase, Stripe, Tiptap, Claude API). The milestone transforms the product from a solo contractor tool into a team collaboration platform with external data integrations and operator analytics. Research across all four domains confirms that the existing stack handles every v2.0 feature without a framework change — the additions are schema-first, incremental, and targeted. The single largest architectural addition is a separate Hocuspocus WebSocket server for real-time co-editing, but research strongly recommends deferring full Yjs CRDT collaborative editing to v3 and shipping presence-only awareness (via Supabase Realtime) in v2.0 — a decision that eliminates a dedicated WebSocket server, a data migration from JSONB to Yjs binary format, and substantial operational cost.

The recommended build order is strict: team accounts are a hard dependency for presence indicators and section comments, so the foundation phase must ship before any collaborative or annotation features. The two external integrations (GovRFP import and SAM.gov prefill) are independent of each other and of team accounts — they can be parallelized or inserted anywhere in the sequence. Win/loss tracking and the operator dashboard are standalone and low-risk; they should start early to begin accumulating outcome data even if the analytics feedback loop ships in v3.

The top risks are architectural, not technical: (1) RLS policies silently break for all team members if the dual-access policy migration is written incorrectly or out of sequence; (2) Stripe subscription quantities diverge from actual seat counts if increments fire on invite-send instead of invite-accept; (3) the scope boundary between "presence indicators" and "real-time collaborative editing" must be enforced as an explicit success criterion in the plan — the two feel adjacent but have completely different infrastructure requirements. All three risks are preventable with well-structured phase plans and the right sequence of tests.

## Key Findings

### Recommended Stack

The existing stack requires no framework-level changes for v2.0. New npm packages are minimal and targeted. The most significant additions are `yjs` + `@tiptap/extension-collaboration` + `@hocuspocus/provider` (reserved for v3 real-time co-editing), `jsondiffpatch` (version history diffs), and `resend` + `@react-email/components` (team invite emails). All integrations with SAM.gov and GovRFP use native `fetch` with no new npm packages.

**Core new dependencies:**
- `yjs ^13.6.30`: CRDT document state — required peer dependency of Tiptap collaboration; hold for v3; pin alongside `@tiptap/extension-collaboration@2.27.2` (NOT `@latest`, which resolves to v3.20.5 and breaks the existing v2 setup)
- `@hocuspocus/provider + server + extension-database ^3.4.4`: WebSocket sync for real-time co-editing — cannot run on Vercel; deploy as separate Railway service; defer to v3 unless presence-only (Supabase Realtime) is insufficient
- `jsondiffpatch ^0.7.3`: JSON diff for version history UI — handles nested Tiptap ProseMirror JSON natively; do not use `diff-match-patch` (unmaintained, CJS-only)
- `resend ^6.9.4` + `@react-email/components ^1.0.10`: Transactional invite emails; 3,000 free/month; DNS domain verification required
- SAM.gov API + GovRFP import: No new packages — native `fetch` in Next.js Server Actions and API Routes

**Critical version constraint:** Pin `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor` to exactly `2.27.2`. The `latest` tag on npm resolves to Tiptap v3 (incompatible CSS classes, renamed extensions, StarterKit breaking changes). When Collaboration extension is added, disable StarterKit's built-in UndoRedo: `{ starterKit: { history: false } }`.

**New environment variables required:** `RESEND_API_KEY`, `SAM_GOV_API_KEY` (Supabase Edge Function secret), `GOVRFP_SHARED_SECRET` (both apps), `NEXT_PUBLIC_HOCUSPOCUS_URL` (if v3 co-editing ships).

See `.planning/research/STACK.md` for full version compatibility table and alternatives considered.

### Expected Features

All 8 features have clear user expectations and implementation patterns. The must-have set for v2.0 is well-defined; the differentiators are achievable within the existing stack.

**Must have (table stakes):**
- Multi-user team accounts with Owner/Editor/Viewer RBAC — proposal-level invite flow, Stripe seat sync on acceptance (not on invite send), RLS migration across 4 tables
- SAM.gov entity prefill via UEI/CAGE — reduces onboarding friction; covers legal business name, NAICS codes, socioeconomic certifications, registration expiry warning
- GovRFP one-click RFP import — seamless cross-product handoff; server-to-server with signed secret; no second login for users
- Win/loss outcome logging — contractors track this in spreadsheets today; the data must start collecting now even if the feedback loop model ships in v3
- Version history with restore — snapshot on explicit save + AI regeneration events only (not on every auto-save); cap at 50 versions per section
- Section comments with threading — requires team accounts live first; uses custom Tiptap CommentMark extension (not paywalled Tiptap Pro Comments)
- Presence indicators (who is viewing which section) — Supabase Realtime Presence only; no Yjs; zero schema changes
- HCC operator dashboard — internal only, aggregate metrics, gated by `app_metadata.role = 'hcc_admin'`

**Should have (competitive differentiators):**
- SAM.gov registration expiration warning — high value, trivially low complexity; contractors frequently miss annual renewal
- `predicted_score` snapshot on bid_outcomes — enables "predicted vs. actual" win score calibration over time
- AI cost tracking in operator dashboard — validates unit economics for HCC
- GovRFP opportunity ID stored on proposals — enables closed-loop win/loss correlation across both products

**Defer (v3+):**
- Full Yjs CRDT real-time collaborative editing — requires Hocuspocus server + JSONB-to-Yjs data migration; confirmed out of v2 scope
- SSO / SAML — enterprise tier only; far exceeds v2 complexity budget
- Automated FPDS award tracking from USASpending.gov — false positive risk; manual logging is sufficient for v2
- Section-level version history (vs. whole-document snapshots) — significantly more complex storage and diff logic
- Win score reweighting from outcome data — data collection starts in v2; model adjustment is v3
- Reps & Certs from SAM.gov — requires elevated system account permissions beyond the public endpoint

See `.planning/research/FEATURES.md` for full feature dependency graph, competitor analysis, and anti-feature rationale.

### Architecture Approach

V2.0 is a schema-first expansion on top of the existing single-app Next.js + Supabase architecture. Every new feature integrates through two patterns: (1) new database tables with dual-access RLS policies (solo owner OR team member via `EXISTS` subquery), and (2) new API routes gated by a server-side `requireProposalRole()` utility built in the Team Accounts phase. The presence feature uses Supabase Realtime Presence channels with `private: true` and `realtime.messages` RLS policies referencing the new `team_memberships` table. External integrations (GovRFP, SAM.gov) are server-to-server fetch calls behind Next.js API Routes — the shared secret never touches browser Client Components. The operator dashboard uses the existing service-role admin client, gated by `app_metadata.role`.

**Major components (new in v2.0):**
1. `team_memberships` + `pending_invites` tables — proposal-level RBAC with invite token flow; indexes on `(proposal_id, user_id)` and `(user_id)` required for RLS performance; dual-policy pattern applied to `proposal_sections`, `rfp_analysis`, `document_jobs`
2. Supabase Realtime Presence channel `proposal:{id}` — `PresenceAvatars` + `SectionPresenceIndicator` components; zero schema changes; `private: true` requires supabase-js v2.44.0+
3. GovRFP import bridge — `GET /api/govrgp/import` server-to-server fetch to `contractor-rfp-website /api/rfp-export/[id]`; signed shared secret; creates proposal row and redirects
4. SAM.gov prefill proxy — `POST /api/sam/prefill` calls SAM.gov v3 Entity API; never exposes raw response to browser; graceful fallback on 401/rate limit; caches result in `profiles.sam_entity_data`
5. `section_versions` table — Tiptap JSON snapshots capped at 50/section; restore via `editor.commands.setContent()`; dual-policy RLS after team accounts land
6. `section_comments` table + Realtime `postgres_changes` — threaded comments with resolve/reopen; custom CommentMark Tiptap extension; @mention notification via Resend
7. `bid_outcomes` table — win/loss log with `predicted_score` snapshot; feeds operator dashboard win rate aggregate
8. `export_logs` table + `/admin/*` protected section — aggregate metrics for HCC; `app_metadata` role guard; service_role queries only; never exposes individual contractor data

See `.planning/research/ARCHITECTURE.md` for full schema change summary, RLS policy SQL, component responsibilities, and v2.0 system diagram.

### Critical Pitfalls

1. **RLS policy explosion when team_id lands** — every existing table uses `auth.uid() = user_id`; a second team member silently sees zero rows (Supabase RLS returns empty, not 403). Write the dual-access RLS migration before any invite UI code. Apply to `proposals`, `document_jobs`, `rfp_analysis`, `proposal_sections`. Index `team_memberships(proposal_id, user_id)` — without it the EXISTS subquery does a full table scan on every row fetch.

2. **Stripe seat quantity divergence** — increment Stripe subscription quantity only on invite acceptance, not on invite send. Read live quantity from Stripe (not DB cache) before computing delta. Add idempotency key tied to `team_member_id` + action. Run nightly reconciliation comparing DB seat count to Stripe quantity.

3. **Presence scope creep into full co-editing** — "presence indicators" and "collaborative editing" look adjacent but have completely different infrastructure. Enforce this as an explicit success criterion in the phase plan: "Supabase Realtime Presence only — no Yjs, no Hocuspocus, no new server." Any mention of `hocuspocus` or Yjs binary format in the presence phase plan is a scope violation.

4. **Version history storage blowout** — snapshotting on every auto-save (30s interval) accumulates ~28MB/proposal/day. Snapshot on: explicit user save, AI regeneration, and first edit after 30-minute idle only. Cap at 50 versions per section; auto-prune oldest non-labeled versions first.

5. **RBAC ghost permissions — viewer bypasses UI to call mutating API** — role enforcement must be server-side on every API route, not just UI conditional rendering. Build `requireProposalRole(proposalId, minRole)` utility in the Team Accounts phase and call it at the top of every mutating route handler before any business logic.

6. **SAM.gov API key 90-day rotation** — individual account keys expire every 90 days with no automated notification. Use a system account key if possible. Store `SAM_GOV_KEY_EXPIRES_AT` and add a server-side health check endpoint. Handle 401 responses with UI fallback ("Enter certifications manually"), never a 500.

7. **GovRFP shared secret in client component** — import call must be server-to-server only. Use a signed JWT with 5-minute TTL rather than a raw long-lived shared secret. Never reference `GOVRFP_SHARED_SECRET` in a `'use client'` file.

See `.planning/research/PITFALLS.md` for full recovery strategies, integration gotchas, and the "looks done but isn't" verification checklist.

## Implications for Roadmap

Based on research, the dependency graph points to a clear phase sequence. Team accounts are a hard upstream dependency for three features; the two external integrations are independent and parallelizable; win/loss and operator dashboard are low-risk parallel tracks.

### Phase 7: Team Accounts + RBAC Foundation

**Rationale:** Hard dependency for presence indicators and section comments. The RLS migration must be the first artifact written — before any invite UI — or team members silently see empty data. Billing seat sync design must live in this same phase because it is tightly coupled to invite acceptance logic.
**Delivers:** Multi-user proposals with Owner/Editor/Viewer roles, email invite flow (Resend), Stripe per-seat billing seat sync on acceptance, `requireProposalRole()` server-side utility
**Addresses:** Feature 1 (Multi-User Team Accounts) from FEATURES.md
**Avoids:** RLS policy explosion (Pitfall 1), Stripe seat divergence (Pitfall 2), RBAC ghost permissions (Pitfall 5)
**Research flag:** Well-documented patterns for Supabase multi-tenant RLS + Stripe per-seat billing — standard phase, skip deep research

### Phase 8: Real-Time Presence Indicators

**Rationale:** Ships in the same wave as or immediately after team accounts (presence has no value for solo users). Scope boundary must be enforced: Supabase Realtime Presence only, no Yjs, no new server infrastructure.
**Delivers:** Avatar stack in editor header, per-section presence dot when another user is active, private channel authorization via `realtime.messages` RLS referencing `team_memberships`
**Addresses:** Feature 2 (Real-Time Co-Editing Presence) — presence-only scope from FEATURES.md
**Avoids:** Presence scope creep into full co-editing (Pitfall 3), Realtime channel authorization hole (Pitfall from PITFALLS.md)
**Research flag:** Supabase Realtime Authorization is Public Beta — verify availability on the current project plan before committing to the `private: true` channel approach

### Phase 9: SAM.gov Entity Prefill + GovRFP Import

**Rationale:** Both are external API integrations with no dependency on team accounts. Can ship in the same phase or separately. SAM.gov is lower risk (read-only, well-documented REST API). GovRFP requires cross-repo coordination on a shared secret and data contract (`OpportunityExportPayload` interface).
**Delivers:** UEI/CAGE lookup populates contractor profile (certifications, NAICS, registration expiry warning); one-click RFP import from GovRFP creates a pre-filled proposal and redirects user
**Addresses:** Feature 3 (GovRFP Import) and Feature 4 (SAM.gov Prefill) from FEATURES.md
**Avoids:** SAM.gov key rotation breaks production (Pitfall 6), SAM.gov rate limit exhaustion (Pitfall 7), GovRFP shared secret in client component (Pitfall)
**Research flag:** SAM.gov `repsAndCerts` field path (`entityData[0].repsAndCerts.certifications`) is MEDIUM confidence — validate against a live registered entity API response before hardcoding the certifications field mapping

### Phase 10: Version History + Section Comments

**Rationale:** Both are editor enhancements that benefit from team accounts being live (comments require teammates for review workflows; version history surfaces "saved by" attribution for team collaboration). Can ship as a combined editor enhancement phase after Phase 7.
**Delivers:** Tiptap JSON snapshot history with diff view and restore; threaded inline section comments with @mention notification; CommentMark Tiptap extension
**Addresses:** Feature 5 (Version History) and Feature 6 (Section Comments) from FEATURES.md
**Avoids:** Version history storage blowout (Pitfall 4); using paywalled Tiptap Pro Comments (confirmed out of scope in STACK.md)
**Research flag:** Tiptap JSON-to-plain-text extraction for `jsondiffpatch` HTML formatter output needs a working proof-of-concept test before committing to the approach — confirm the ProseMirror node walk produces readable diff output with real proposal content

### Phase 11: Win/Loss Tracking + Operator Dashboard

**Rationale:** Both are standalone with no upstream dependencies on team accounts. Win/loss data collection must start as early as possible — the feedback loop model adjustment ships in v3 but the data corpus must accumulate now. Operator dashboard is internal-only and can ship last without blocking any user-facing feature.
**Delivers:** Bid outcome logging with predicted vs. actual win score snapshot; contractor analytics page (win rate, loss reason breakdown, agency segmentation); HCC admin aggregate metrics dashboard with AI cost tracking and export CSV
**Addresses:** Feature 7 (Win/Loss Tracking) and Feature 8 (HCC Operator Dashboard) from FEATURES.md
**Avoids:** Operator dashboard privacy violation (aggregate counts only — no individual contractor proposal titles or RFP content exposed to HCC admins)
**Research flag:** `proposals_analytics` materialized view refresh strategy (pg_cron hourly vs. on-demand) is a standard PostgreSQL pattern — no deep research needed; decide approach at plan time

### Phase Ordering Rationale

- Phase 7 before Phase 8: `team_memberships` table must exist for the Realtime `realtime.messages` RLS policy to reference it; cannot ship presence authorization without team schema
- Phase 7 before Phase 10: Section comments have no value without teammates to receive @mentions; version "saved by" attribution requires team memberships to display correctly
- Phase 9 is independent: SAM.gov and GovRFP have no dependency on the team schema; can be moved earlier if business priority demands
- Phase 11 is independent and parallel: Win/loss data collection starting earlier is desirable; outcome data from earlier phases enriches the v3 feedback loop
- All phases after Phase 7: The `requireProposalRole()` utility built in Phase 7 is reused in every subsequent phase that adds mutating API routes — write it once, use it everywhere

### Research Flags

Phases needing deeper research during planning:
- **Phase 8 (Realtime Authorization):** Supabase Realtime Authorization (`private: true` channel + `realtime.messages` RLS) is Public Beta — verify availability on the project's current Supabase plan before Phase 8 planning begins
- **Phase 9 (SAM.gov):** SAM.gov `repsAndCerts.certifications` field paths are MEDIUM confidence — validate against a live registered entity API response before writing the field mapping in Phase 9 planning

Phases with well-established patterns (skip deep research):
- **Phase 7 (Team Accounts):** Supabase multi-tenant RLS + Stripe per-seat billing are heavily documented; pitfalls are known and preventable with the correct phase sequence
- **Phase 10 (Version History):** Postgres JSONB snapshots + `jsondiffpatch` is a straightforward implementation; no novel architecture
- **Phase 11 (Win/Loss + Dashboard):** Simple data model; standard aggregate queries; `app_metadata` role guard is an established Supabase Auth pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry 2026-03-25; Tiptap v2/v3 breaking changes confirmed via official upgrade guide; Hocuspocus v3.4.4 current stable confirmed |
| Features | MEDIUM-HIGH | Table stakes verified via official API docs and multiple B2B SaaS sources; GovCon-specific claims (win/loss value, SAM.gov usage patterns) verified via 3+ sources |
| Architecture | HIGH | Based on confirmed existing codebase migrations 00001-00004; RLS dual-policy pattern and Realtime authorization verified via Supabase official docs; GovRFP data contract is a proposed interface pending cross-team agreement |
| Pitfalls | HIGH | All critical pitfalls grounded in existing codebase schema and official Supabase/Stripe/SAM.gov documentation; RLS silent failure behavior and SAM.gov key rotation confirmed via official sources |

**Overall confidence:** HIGH

### Gaps to Address

- **SAM.gov `repsAndCerts` field paths:** MEDIUM confidence only. The certifications mapping (`businessTypes` array to ProposalAI cert schema) needs validation against a live SAM.gov API response with a real registered entity before the field mapping in Phase 9 is finalized. Do not hardcode field paths without a live API test.
- **Supabase Realtime Authorization plan availability:** Realtime Authorization (channel-level `private: true` + `realtime.messages` RLS) is Public Beta. Verify the current Supabase project plan supports it before Phase 8 implementation begins; fallback is custom JWT verification in an Edge Function.
- **GovRFP `OpportunityExportPayload` data contract:** The interface defined in ARCHITECTURE.md is a proposed contract and must be agreed on with the `contractor-rfp-website` codebase maintainer before either side builds the integration. This is a coordination dependency, not a technical unknown.
- **Hocuspocus scope decision for v3:** Research recommends deferring full Yjs co-editing to v3. If requirements change and true collaborative editing is scoped into v2.0, the Hocuspocus Railway deployment, JSONB-to-Yjs content migration, and Tiptap extension version pins become Phase 8 blockers — the roadmap needs an explicit branch decision before Phase 8 planning.

## Sources

### Primary (HIGH confidence)
- npm registry (verified 2026-03-25) — yjs 13.6.30, @hocuspocus/* 3.4.4, @tiptap/* v2-latest 2.27.2, jsondiffpatch 0.7.3, resend 6.9.4, @react-email/components 1.0.10
- [Tiptap v2 Collaboration docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) — package list, StarterKit undo conflict warning
- [Tiptap v2 to v3 upgrade guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2) — breaking changes confirmed (cursor renamed to caret, CSS prefix change)
- [Hocuspocus docs](https://tiptap.dev/docs/hocuspocus/getting-started/overview) — server setup, extension-database hooks pattern
- [GSA SAM.gov Entity Management API](https://open.gsa.gov/api/entity-api/) — endpoint, auth, rate limits, response fields
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) — private channels, realtime.messages RLS policies
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence) — presence API confirmed stable
- [Stripe Per-Seat Pricing docs](https://docs.stripe.com/subscriptions/pricing-models/per-seat-pricing) — quantity update, proration behavior
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — EXISTS subquery performance, index requirements
- Existing codebase migrations 00001_foundation_schema.sql through 00004_proposal_sections.sql — confirmed schema baseline
- [Supabase Realtime Authorization blog](https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization) — authorization pattern confirmed

### Secondary (MEDIUM confidence)
- [Supabase community discussion on y-supabase](https://github.com/orgs/supabase/discussions/27105) — confirmed not production-ready; author warning noted
- [Community Tiptap comments article](https://dev.to/sereneinserenade/how-i-implemented-google-docs-like-commenting-in-tiptap-k2k) — custom CommentMark production pattern verified
- [SAM.gov rate limits (govconapi.com, 2026)](https://govconapi.com/sam-gov-rate-limits-reality) — 1,000 req/day rate confirmed
- [makerkit.dev Supabase RLS guide](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — multi-tenant policy patterns
- [makerkit.dev per-seat Stripe recipe](https://makerkit.dev/recipes/per-seat-stripe-subscriptions) — seat increment timing (acceptance, not invite)
- [Tiptap pricing page](https://tiptap.dev/pricing) — confirmed Pro Comments requires paid platform subscription
- [Resend Next.js integration docs](https://resend.com/docs/send-with-nextjs) — React Email integration pattern confirmed

### Tertiary (LOW confidence)
- [moment.dev "Lies I Was Told About Collaborative Editing"](https://www.moment.dev/blog/lies-i-was-told-pt-2) — directional reasoning for presence-only vs. full CRDT; qualitative, not benchmarked

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
