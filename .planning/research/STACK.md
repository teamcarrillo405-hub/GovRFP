# Stack Research — v2.0 New Feature Additions

**Domain:** Government proposal SaaS — v2.0 collaboration + integrations milestone
**Researched:** 2026-03-25
**Confidence:** HIGH (all packages verified via npm registry; architecture patterns verified via official docs)

> This file covers ONLY the new packages needed for v2.0.
> Existing stack (Next.js 16.2.1, React 19, Supabase, Stripe v20, Claude API, Tiptap v2.27.2, Zod v4, Vitest, Playwright) is locked and not re-researched.

---

## Feature-to-Package Mapping

| Feature | New Packages | Uses Existing |
|---------|-------------|---------------|
| Multi-user team accounts + RBAC | `resend`, `@react-email/components` | Supabase RLS, Stripe quantity update |
| Real-time co-editing presence | `yjs`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`, `@hocuspocus/provider`, `@hocuspocus/server`, `@hocuspocus/extension-database` | Tiptap v2, Supabase DB |
| GovRFP one-click import | none (shared secret + fetch) | Next.js API routes |
| SAM.gov entity prefill | none (direct REST fetch to api.sam.gov) | Next.js server actions |
| Version history | `jsondiffpatch` | Supabase DB (JSONB snapshots), Tiptap JSON |
| Section comments / annotation | none (custom Tiptap mark) | `@tiptap/pm`, Supabase DB |
| Win/loss tracking | none | Supabase DB (new table), existing win-score lib |
| HCC operator dashboard | none | Supabase DB (pg views/aggregates), existing auth |

---

## Recommended Stack Additions

### Core New Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `yjs` | ^13.6.30 | CRDT document state for collaborative editing | Industry standard for conflict-free real-time sync; required by Tiptap's collaboration extension; no alternative with comparable ecosystem |
| `@tiptap/extension-collaboration` | 2.27.2 (pin exact) | Binds Yjs document to Tiptap editor | Official extension; pin to v2-latest — v3 is latest on npm but incompatible with existing Tiptap v2.27 setup |
| `@tiptap/extension-collaboration-cursor` | 2.27.2 (pin exact) | Renders remote user cursors in editor | Official extension; same version constraint as above — v3 renamed to `extension-collaboration-caret` with CSS class changes |
| `@hocuspocus/provider` | ^3.4.4 | WebSocket client connecting Tiptap to Hocuspocus server | Purpose-built Yjs provider for Tiptap; abstracts auth + reconnection; pairs with `@hocuspocus/server` |
| `@hocuspocus/server` | ^3.4.4 | Yjs WebSocket server for document sync | Required for real-time editing; cannot run inside Vercel (serverless); deploy as separate Railway service |
| `@hocuspocus/extension-database` | ^3.4.4 | Persists Yjs binary state to Supabase | Generic fetch/store hooks — connect to Supabase `proposal_ydoc` column (bytea) directly |
| `jsondiffpatch` | ^0.7.3 | Diff Tiptap JSON snapshots for version history UI | Handles nested JSON diff + patch natively; produces delta format suitable for display; has HTML visualizer output. Use over `diff-match-patch` (stale, CJS-only) |
| `resend` | ^6.9.4 | Transactional email for team invitations | Best DX for Next.js + React Email templates; DNS domain verification; 3,000 free emails/month; aligns with existing stack philosophy |
| `@react-email/components` | ^1.0.10 | React component templates for invite emails | Same team as Resend; built-in preview server; familiar React patterns; no new templating language |

### Development Dependencies (no changes needed)

All testing infrastructure (Vitest, Playwright) remains unchanged. Hocuspocus server tests run in Node environment compatible with Vitest.

---

## Architecture Decision: Real-Time Editing Infrastructure

The biggest architectural addition in v2.0 is the Hocuspocus WebSocket server. This cannot run inside Next.js on Vercel.

**Required topology:**

```
Browser (Tiptap + HocuspocusProvider)
  --> WebSocket --> Hocuspocus Server (Railway, Node.js, port 1234)
                     --> Supabase DB (persist binary Yjs state in proposals table)

Browser (Supabase Realtime client)
  --> Supabase Realtime Broadcast --> presence sidebar (who is viewing, NOT cursor positions)
```

**Why split this way:**

- Hocuspocus handles document CRDT sync (Yjs binary updates) + cursor awareness — requires persistent WebSocket connection, incompatible with serverless
- Supabase Realtime Presence handles "who's viewing this proposal" display in the sidebar — lightweight, works with existing Supabase client, no new server needed
- Do NOT attempt to use Supabase Realtime as a Yjs provider: `y-supabase` npm package has 306 weekly downloads, author warns "not production ready", API changes frequently

---

## Package-by-Package Rationale

### yjs ^13.6.30

CRDT library. Required peer dependency of `@tiptap/extension-collaboration`. There is no alternative — Tiptap's collaboration stack is built entirely on Yjs. Version 13.x is the current stable series.

### @tiptap/extension-collaboration + @tiptap/extension-collaboration-cursor at 2.27.2

CRITICAL VERSION CONSTRAINT: Pin these to exactly `2.27.2`. The `latest` dist-tag on npm now points to v3.20.5 (Tiptap v3), which has breaking changes incompatible with existing v2.27 setup:

- `extension-collaboration-cursor` renamed to `extension-collaboration-caret` in v3
- CSS classes changed from `.collaboration-cursor__caret` to `.collaboration-carets__caret`
- `history` option renamed to `undoRedo`
- StarterKit incompatibility with existing v2 extensions

The `v2-latest` dist-tag on npm confirms 2.27.2 as the correct v2 pin. Running `npm install @tiptap/extension-collaboration@latest` will pull v3 and break the existing setup.

Also: when Collaboration extension is added, the StarterKit's built-in UndoRedo must be disabled — Collaboration ships its own Yjs-aware history. Add `{ starterKit: { history: false } }` to the existing editor configuration.

### @hocuspocus/provider + @hocuspocus/server + @hocuspocus/extension-database ^3.4.4

All three stay in sync at the same version (monorepo). v3.4.4 is current stable.

- `@hocuspocus/provider` goes in the Next.js app (browser-side, client component)
- `@hocuspocus/server` + `@hocuspocus/extension-database` go in a separate `hocuspocus-server/` Node.js service deployed to Railway

Hocuspocus uses the `@hocuspocus/extension-database` generic hooks pattern to persist Yjs binary state:
- `fetch`: `SELECT ydoc_state FROM proposals WHERE id = $1` (returns `Uint8Array | null`)
- `store`: `UPDATE proposals SET ydoc_state = $1 WHERE id = $2`
- Auth via `onAuthenticate` hook — verify Supabase JWT passed from browser on WebSocket connect

### jsondiffpatch ^0.7.3

For version history: when a user saves, store the current Tiptap JSON as a JSONB snapshot in a `proposal_versions` table. Use `jsondiffpatch.diff(old, new)` to produce a delta, then `jsondiffpatch.formatters.html.format(delta, old)` for visual display.

Do NOT use `diff-match-patch` — the original npm package is 4 years unmaintained and CJS-only. `jsondiffpatch` handles nested JSON (which Tiptap's ProseMirror JSON format is) natively.

### resend ^6.9.4 + @react-email/components ^1.0.10

For team invite emails. The only setup cost is adding a DNS TXT record to the HCC domain and a `RESEND_API_KEY` env var. 3,000 free emails/month is more than sufficient at HCC's current scale.

---

## SAM.gov API Integration Details

No new npm packages needed. Use native `fetch` in a Next.js Server Action.

**Endpoint:** `https://api.sam.gov/entity-information/v3/entities`

**Authentication:** API key as query parameter `?api_key=YOUR_KEY`. Key obtained from SAM.gov account profile page. Public data is accessible with a non-federal registered entity account.

**Rate limits:**
- Public access (no account): 10 req/day — insufficient for production
- Registered entity account: 1,000 req/day — sufficient for HCC's user base at launch
- Federal system account: 10,000 req/day — available if needed later

**Lookup parameters:**
- `ueiSAM` — 12-character UEI (primary; replaces DUNS)
- `cageCode` — 5-character CAGE code
- `legalBusinessName` — partial text search

**Key returned fields for contractor profile prefill:**
- `entityRegistration.legalBusinessName`
- `entityRegistration.ueiSAM`, `entityRegistration.cageCode`
- `entityRegistration.registrationStatus`
- `assertions.goodsAndServices.naicsCode` (list)
- `entityRegistration.businessTypes` (woman-owned, veteran-owned, 8(a), HUBZone, etc.)

Store the SAM.gov API key in Supabase Edge Function secrets (same pattern as `ANTHROPIC_API_KEY`), never in `.env.local`.

---

## GovRFP Import Integration Details

No new npm packages needed. Internal API call between two Next.js apps sharing the same operator.

**Pattern:**
1. GovRFP adds a "Send to ProposalAI" button on an RFP detail page
2. Button calls `POST /api/integrations/govrfp/import` on ProposalAI
3. Authentication: `Authorization: Bearer <GOVRFP_SHARED_SECRET>` header — both apps hold the same secret in env
4. Payload: RFP metadata (title, agency, due date, source URL, document URL)
5. ProposalAI creates a new proposal record and returns a redirect URL to the new proposal editor

**New env var:** `GOVRFP_SHARED_SECRET` (same value set in both apps)

This avoids OAuth complexity — single operator, not multi-tenant across organizations.

---

## Team Accounts + RBAC — No New Packages

All RBAC is implemented via Supabase RLS + new tables. No external RBAC library needed.

**Schema pattern:**
```sql
-- teams table (org-level container)
-- team_members(team_id, user_id, role enum('owner','editor','viewer'), invited_by, joined_at)
-- team_member_invitations(id, team_id, email, role, token uuid, expires_at, accepted_at)
-- proposals: add team_id column

-- RLS policy (proposals read — editor/viewer):
-- EXISTS (SELECT 1 FROM team_members WHERE team_id = proposals.team_id AND user_id = auth.uid())

-- RLS policy (proposals write — owner/editor only):
-- EXISTS (SELECT 1 FROM team_members WHERE team_id = proposals.team_id AND user_id = auth.uid() AND role IN ('owner','editor'))
```

**Stripe per-seat update:** When a team member is added/removed, call `stripe.subscriptions.update` with new `quantity`. Uses existing Stripe v20 client — no new package needed.

---

## Section Comments — Custom Tiptap Mark (No New Packages, No Pro)

Tiptap Pro comments are paywalled (no public price; requires sales contact; requires Tiptap Platform for threaded sync). Build a custom mark instead using existing `@tiptap/pm`.

**Pattern** (proven community approach):
1. Custom Tiptap `Mark` extension named `CommentMark` with `commentId` attribute
2. Highlighted text stores `commentId` in the mark data
3. `proposal_comments` table: `id`, `proposal_id`, `comment_id` (anchor), `parent_id` (nullable, for threading), `body`, `created_by`, `resolved_at`
4. Comments sidebar component loads threads by `proposal_id` via Supabase query
5. Clicking a comment highlights the corresponding mark in the editor via `editor.commands.setTextSelection`

This gives Google Docs-like inline comments with no paid dependency.

---

## Version History — No New Packages Beyond jsondiffpatch

**Schema:**
```sql
CREATE TABLE proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  label text, -- e.g. "Before AI regeneration of Technical Approach"
  content jsonb NOT NULL -- full Tiptap JSON snapshot
);
```

**Restore:** `editor.commands.setContent(version.content)` — existing Tiptap API, no new packages.

---

## Win/Loss Tracking — No New Packages

```sql
CREATE TABLE bid_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  outcome text CHECK (outcome IN ('won','lost','no_bid','pending')),
  submitted_at date,
  award_amount numeric,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

Historical outcomes feed into win probability as new computed factors in the existing `win-score.ts` lib.

---

## HCC Operator Dashboard — No New Packages

Postgres aggregate views + a `/admin` layout gated by `profiles.is_operator = true`. Use existing Supabase admin client.

---

## Installation

```bash
# Real-time editing (Tiptap collaboration)
# IMPORTANT: pin to 2.27.2 — npm latest tag now points to Tiptap v3
npm install yjs@^13.6.30
npm install @tiptap/extension-collaboration@2.27.2
npm install @tiptap/extension-collaboration-cursor@2.27.2
npm install @hocuspocus/provider@^3.4.4

# Version history diff
npm install jsondiffpatch@^0.7.3

# Team invite emails
npm install resend@^6.9.4 @react-email/components@^1.0.10
```

```bash
# Hocuspocus server (separate hocuspocus-server/ service in monorepo or standalone repo)
npm install @hocuspocus/server@^3.4.4 @hocuspocus/extension-database@^3.4.4 yjs@^13.6.30
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hocuspocus (self-hosted Railway) | Tiptap Cloud (managed) | If ops burden for a separate server is unacceptable; Tiptap Cloud removes that at a monthly cost with vendor lock-in |
| Hocuspocus (self-hosted Railway) | Liveblocks | If you need presence + comments + version history all managed by a vendor and per-MAU pricing is acceptable |
| Custom CommentMark (free) | Tiptap Pro Comments | If budget allows and you want zero custom code for the commenting UI |
| `jsondiffpatch` | `diff-match-patch` | Never — `diff-match-patch` is 4 years unmaintained; `jsondiffpatch` is the maintained successor for JS |
| Resend + React Email | Supabase Auth email templates | If emails are only auth-related (reset, confirm) — Supabase templates cover those; Resend is needed for invite flows |
| Supabase RLS (custom) | CASL / Casbin | If roles become complex (permission sets, dynamic rules) — at 3 static roles, dedicated RBAC libraries are overkill |
| Native fetch (SAM.gov) | Third-party SAM.gov npm wrapper | No production-grade npm wrapper exists; direct REST is well-documented by GSA |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tiptap/extension-collaboration@latest` | npm `latest` tag resolves to v3.20.5 — breaks existing v2.27 setup | Pin exactly to `2.27.2` |
| `y-supabase` | 306 weekly downloads; author warns not production-ready; API unstable | Hocuspocus + `@hocuspocus/extension-database` |
| `socket.io` | Hocuspocus uses native WebSocket; socket.io adds 50KB+ overhead with no benefit here | `@hocuspocus/provider` (already wraps ws) |
| `@tiptap-pro/extension-comments` | Requires Tiptap Platform subscription + sales call; cloud-dependent for thread sync | Custom `CommentMark` + Supabase `proposal_comments` table |
| `@tiptap-pro/extension-collaboration-history` | Same pro paywall; v3-only anyway | Postgres JSONB snapshots + `jsondiffpatch` |
| `casl` or `casbin` | RBAC overkill for 3 static roles (owner/editor/viewer) | Supabase RLS policies (3 policies cover all access patterns) |
| `next-ws` | Patches Next.js internals; fragile; unsupported on Vercel | Hocuspocus as separate Railway service |
| Inngest | Already decided against in v1.0 (double-trigger footgun); no new use case justifies it | pg_cron (already in use for job polling) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@tiptap/extension-collaboration@2.27.2` | `@tiptap/starter-kit@^2.27.2`, `@tiptap/react@^2.27.2` | Must disable UndoRedo from StarterKit when adding Collaboration: `{ starterKit: { history: false } }` |
| `@tiptap/extension-collaboration-cursor@2.27.2` | `@tiptap/extension-collaboration@2.27.2` | Must be installed alongside core collaboration extension |
| `@hocuspocus/provider@3.4.4` | `yjs@^13.6.x` | Requires yjs 13.x |
| `@hocuspocus/server@3.4.4` | `@hocuspocus/extension-database@3.4.4` | All `@hocuspocus/*` packages must be on the same minor version |
| `jsondiffpatch@0.7.3` | Node.js 18+ | ESM-compatible; `import { diff, patch } from 'jsondiffpatch'` |
| `resend@6.9.4` | Next.js Server Actions, Route Handlers | Server-side only; `RESEND_API_KEY` never sent to browser |

---

## New Environment Variables Required

| Variable | Where | Purpose |
|----------|-------|---------|
| `RESEND_API_KEY` | `.env.local` + Vercel | Transactional invite emails |
| `SAM_GOV_API_KEY` | Supabase Edge Function secrets | SAM.gov entity lookup (registered account, 1,000 req/day) |
| `GOVRFP_SHARED_SECRET` | `.env.local` + Vercel (and `contractor-rfp-website`) | Internal API auth for GovRFP one-click import |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | `.env.local` + Vercel | WebSocket endpoint for HocuspocusProvider in browser |
| `HOCUSPOCUS_AUTH_SECRET` | Hocuspocus server env only | Verify Supabase JWTs passed from browser on WebSocket connect |

---

## Sources

- npm registry (`npm show` verified 2026-03-25) — yjs 13.6.30, @hocuspocus/* 3.4.4, @tiptap/extension-collaboration 3.20.5 (latest) and 2.27.2 (v2-latest), jsondiffpatch 0.7.3, resend 6.9.4, @react-email/components 1.0.10
- [Tiptap v2 Collaboration docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) — package list, StarterKit undo conflict warning
- [Tiptap upgrade v2 to v3 guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2) — confirmed v3 breaking changes (cursor renamed to caret, CSS class prefix change)
- [Hocuspocus docs](https://tiptap.dev/docs/hocuspocus/getting-started/overview) — server setup, extension-database hooks pattern
- [Supabase Realtime Presence docs](https://supabase.com/docs/guides/realtime/presence) — presence API confirmed stable and separate from Yjs sync
- [Supabase community discussion on y-supabase](https://github.com/orgs/supabase/discussions/27105) — confirmed no official Supabase Yjs provider; y-supabase not production-ready
- [GSA SAM.gov Entity Management API](https://open.gsa.gov/api/entity-api/) — endpoint, auth, rate limits, response fields verified
- [Tiptap pricing page](https://tiptap.dev/pricing) — confirmed Comments extension requires paid platform (sales-only pricing)
- [Community Tiptap comments article](https://dev.to/sereneinserenade/how-i-implemented-google-docs-like-commenting-in-tiptap-k2k) — custom CommentMark approach verified as production pattern
- [Resend Next.js integration docs](https://resend.com/docs/send-with-nextjs) — confirmed React Email integration pattern

---
*Stack research for: HCC ProposalAI v2.0 — collaboration + integrations*
*Researched: 2026-03-25*
