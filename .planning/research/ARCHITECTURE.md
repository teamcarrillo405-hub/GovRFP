# Architecture Research — HCC ProposalAI v2.0

**Domain:** Collaborative SaaS — Government Proposal Management
**Researched:** 2026-03-25
**Confidence:** HIGH (based on confirmed codebase + verified Supabase/SAM.gov docs)

---

## Existing Architecture Baseline (v1.1)

```
+------------------------------------------------------------------+
|                    Next.js 16.2.1 App Router                      |
|  +-----------+  +-------------+  +----------+  +-------------+   |
|  | (auth)    |  | (dashboard) |  | api/     |  | auth/       |   |
|  | login     |  | proposals/  |  | draft    |  | confirm/    |   |
|  | signup    |  | [id]/editor |  | sections |  |             |   |
|  | reset     |  | [id]/analysis  | export/  |  |             |   |
|  +-----------+  +-------------+  +----------+  +-------------+   |
+------------------------------------------------------------------+
|                    Component Layer                                 |
|  +--------------+  +----------------+  +--------------------+    |
|  | ProposalEditor|  | CompliancePanel |  | RfpStructureSidebar|  |
|  | SectionEditor |  | WinScoreCard   |  | ExportButtons      |   |
|  | EditorToolbar |  | ComplianceMatrix|  | ProcessingStatus   |   |
|  +--------------+  +----------------+  +--------------------+    |
+------------------------------------------------------------------+
|                    Supabase                                        |
|  +---------+  +------------+  +---------+  +---------+           |
|  | Auth    |  | PostgreSQL |  | Realtime|  | Storage |           |
|  | (PKCE)  |  | + RLS      |  | pg_chgs |  | rfp-docs|           |
|  +---------+  +------------+  +---------+  +---------+           |
+------------------------------------------------------------------+
|             External Services                                      |
|  +-----------+  +-----------+  +----------------+                 |
|  | Claude API|  |  Stripe   |  | AWS Textract   |                |
|  | sonnet-4-6|  |  v20      |  | (OCR)          |                |
|  +-----------+  +-----------+  +----------------+                 |
+------------------------------------------------------------------+
```

**Current schema tables (confirmed from migrations 00001-00004):**

| Table | Owner column | Key content |
|-------|-------------|-------------|
| `profiles` | `id` (= auth.uid) | Stripe fields, certifications, uei_cage |
| `proposals` | `user_id` | file/parse fields, status state machine, rfp_text |
| `proposal_sections` | `user_id` | 5 named sections; Tiptap JSON in `content` JSONB |
| `document_jobs` | `user_id` | async job queue; `job_type` in ('document','analysis') |
| `rfp_analysis` | `user_id` | requirements, compliance_matrix, win_factors JSONB |
| `past_projects` | `user_id` | contractor history |
| `key_personnel` | `user_id` | team bios |

**RLS pattern across all tables:** `(select auth.uid()) = user_id` (cached subquery form)

---

## v2.0 Feature Integration Map

### Feature 1: Multi-User Team Accounts

**Integration type:** Schema-first — adds two new tables, modifies RLS on four existing ones.

**Root problem:** `proposals.user_id` is a single owner. No path for a second user to access the same proposal. RLS blocks any other `auth.uid()`.

**New tables required:**

```sql
-- team_memberships: proposal-level RBAC
create table public.team_memberships (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  invited_by   uuid references auth.users,
  invited_at   timestamptz not null default now(),
  accepted_at  timestamptz,           -- null = pending invite
  unique (proposal_id, user_id)
);
alter table public.team_memberships enable row level security;

-- pending_invites: email invites for users not yet in auth.users
create table public.pending_invites (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('editor', 'viewer')),
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid not null references auth.users,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  unique (proposal_id, email)
);
```

**Modified tables:**
- `proposals`: add `team_enabled boolean default false` — soft flag; solo proposals keep existing RLS path unchanged
- `proposal_sections`, `rfp_analysis`, `document_jobs`: keep existing `user_id` policy, add a second SELECT/UPDATE policy for team members

**RLS dual-policy pattern (apply to proposal_sections, rfp_analysis):**

```sql
-- Original policy stays untouched
-- Add team access policy
create policy "Team members can read proposal_sections"
  on proposal_sections for select to authenticated
  using (
    exists (
      select 1 from public.team_memberships tm
      where tm.proposal_id = proposal_sections.proposal_id
        and tm.user_id = (select auth.uid())
        and tm.accepted_at is not null
    )
  );

-- Editors (not viewers) can write
create policy "Team editors can update proposal_sections"
  on proposal_sections for update to authenticated
  using (
    exists (
      select 1 from public.team_memberships tm
      where tm.proposal_id = proposal_sections.proposal_id
        and tm.user_id = (select auth.uid())
        and tm.role in ('owner', 'editor')
        and tm.accepted_at is not null
    )
  );
```

**Invite flow:**
1. Owner: `POST /api/proposals/[id]/invites` with `{email, role}` — creates `pending_invites` row, calls `supabase.auth.admin.inviteUserByEmail()` (admin client, already in `src/lib/supabase/admin.ts`)
2. Recipient: clicks email link → `GET /api/invites/accept?token=...` — validates token + expiry, creates `team_memberships` row with `accepted_at = now()`, deletes `pending_invites` row
3. If user already exists in auth.users: skip inviteUserByEmail, send custom notification email via admin client

**New components:**
- `src/components/team/InviteModal.tsx` — email input + role selector
- `src/components/team/MemberList.tsx` — current members with role badges + remove action
- `src/app/(dashboard)/proposals/[id]/team/page.tsx` — team management page

**New routes:**
- `src/app/api/proposals/[id]/invites/route.ts` — POST invite
- `src/app/api/invites/accept/route.ts` — GET accept invite

**Modified components:**
- `src/app/(dashboard)/proposals/[id]/page.tsx` — add Team tab alongside Analysis tab

**Critical indexes (RLS performance):**
```sql
create index on team_memberships (proposal_id, user_id);
create index on team_memberships (user_id);
```

---

### Feature 2: Real-Time Co-Editing Presence

**Integration type:** New Realtime channel + 2 new components + minor ProposalEditor modification. Zero schema changes.

**What this is NOT:** Not Yjs collaborative text editing. Not character-level conflict resolution. Only awareness — who is viewing/editing which section.

**Architecture decision:** Use Supabase Realtime **Presence** (not Broadcast). Presence auto-cleans on disconnect; Broadcast requires explicit leave messages. Presence is the right primitive for "who is here" problems.

**Channel naming:** `proposal:{proposal_id}` — one channel per proposal, all section editors join the same channel.

**Presence payload:**

```typescript
interface PresencePayload {
  user_id: string
  display_name: string       // profiles.company_name or email prefix
  avatar_initials: string    // first letter of display_name
  active_section: string | null   // which SectionEditor has focus
  joined_at: string          // ISO timestamp
}
```

**Realtime authorization — new RLS policy on realtime.messages:**

```sql
create policy "Proposal members can join presence channel"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and (
      exists (
        select 1 from public.proposals p
        where p.id::text = realtime.topic()
          and p.user_id = (select auth.uid())
      )
      or
      exists (
        select 1 from public.team_memberships tm
        where tm.proposal_id::text = realtime.topic()
          and tm.user_id = (select auth.uid())
          and tm.accepted_at is not null
      )
    )
  );
```

**New files:**
- `src/lib/realtime/presence.ts` — `useProposalPresence(proposalId)` hook wrapping channel subscribe/track/untrack
- `src/components/editor/PresenceAvatars.tsx` — avatar stack in editor header
- `src/components/editor/SectionPresenceIndicator.tsx` — small dot on section tab if another user is active there

**Modified files:**
- `src/components/editor/ProposalEditor.tsx` — mount PresenceAvatars, pass section focus events to presence hook
- `src/components/editor/SectionEditor.tsx` — on focus, call `presence.setActiveSection(sectionName)`

**Hard dependency:** Team accounts (Feature 1) must migrate first — `team_memberships` table must exist before the Realtime RLS policy can reference it.

---

### Feature 3: GovRFP Import

**Integration type:** New API bridge between two separate Next.js apps. Schema extension to `proposals`. One new route in ProposalAI. One new route in GovRFP.

**Context from GovRFP codebase (confirmed):** `contractor-rfp-website` has an `opportunities` table with `id`, `solicitation_number`, `title`, `agency_name`, `naics_code`, `set_aside_type`, `response_deadline`, `description_text`, `ui_link`, `source_url`. It runs its own Supabase project.

**Why not direct DB access:** The two apps have separate Supabase projects, separate RLS contexts, and different user bases. Direct DB access would require service role key sharing — rejected. Server-to-server HTTP with shared secret is the correct pattern at this scale.

**Data flow:**

```
GovRFP UI (contractor-rfp-website)
  User clicks "Respond with ProposalAI" on opportunity detail page
        |
        | deeplink to ProposalAI
        v
ProposalAI: GET /api/govrgp/import?opportunity_id={id}&token={jwt}
        |
        | server-to-server fetch
        v
GovRFP: GET /api/rfp-export/[id]
  Authorization: Bearer {GOVRGP_EXPORT_SECRET}
  Returns: OpportunityExportPayload
        |
        v
ProposalAI: creates proposals row with prefilled fields
  Redirects user to /proposals/[newId]
```

**Shared interface (agree between apps):**

```typescript
interface OpportunityExportPayload {
  govrfp_id: string
  solicitation_number: string | null
  title: string
  agency_name: string | null
  naics_code: string | null
  set_aside_type: string | null
  response_deadline: string | null   // ISO timestamp
  description_text: string | null
  ui_link: string | null             // back-link to source
}
```

**Schema change — extend proposals:**

```sql
alter table public.proposals
  add column govrfp_opportunity_id   text,
  add column solicitation_number     text,
  add column source_agency           text,
  add column response_deadline       timestamptz;
```

**New files — ProposalAI:**
- `src/app/api/govrgp/import/route.ts` — GET: validates auth + shared secret, fetches from GovRFP, creates proposal, redirects

**New files — GovRFP (contractor-rfp-website):**
- `app/api/rfp-export/[id]/route.ts` — GET: validates `Authorization: Bearer {GOVRGP_EXPORT_SECRET}`, queries `opportunities` table, returns payload

**GovRFP UI change:**
- `app/opportunities/[id]/page.tsx` — add "Respond with ProposalAI" button linking to `{PROPOSALAI_URL}/api/govrgp/import?opportunity_id={id}`

**New env vars:**
- Both apps: `GOVRGP_EXPORT_SECRET` — same value (rotate if compromised)
- ProposalAI: `NEXT_PUBLIC_GOVRGP_BASE_URL` — for back-link display
- GovRFP: `PROPOSALAI_URL` — for button href construction

---

### Feature 4: SAM.gov Entity Prefill

**Integration type:** New server-side proxy route + minor profile-form UI addition. No schema changes — `profiles.uei_cage` and `profiles.certifications text[]` already exist.

**API confirmed:** `GET https://api.sam.gov/entity-information/v3/entities?ueiSAM={uei}&api_key={key}&includeSections=repsAndCerts`
- OR: `?cageCode={cage}` for CAGE code lookup
- Rate limit: 1,000 req/day (system account key required)
- API key must be a **system account** key, not a personal key (personal no-role = 10/day)

**Certifications mapping (MEDIUM confidence — exact field path needs live validation):**

```typescript
// SAM.gov response path: entityData[0].repsAndCerts.certifications
// businessTypes array contains SBA program flags
const CERT_MAP: Record<string, string> = {
  '8(a) Program Participant': '8(a)',
  'HUBZone Firm': 'HUBZone',
  'Women Owned Small Business': 'WOSB',
  'Service-Disabled Veteran Owned Small Business': 'SDVOSB',
  'Small Disadvantaged Business': 'SDB',
}
```

**New route:**
- `src/app/api/sam/prefill/route.ts` — POST `{identifier, type: 'uei'|'cage'}`: calls SAM.gov server-side, returns mapped payload. Never returns the raw SAM.gov response to the browser.

**Modified files:**
- `src/components/profile/profile-form.tsx` — add "Fetch from SAM.gov" button next to uei_cage field; calls `/api/sam/prefill`; shows mapped certifications in a confirmation step before overwriting existing data

**New env var:**
- `SAM_GOV_API_KEY` — system account key, server-side only

**Risk:** SAM.gov `repsAndCerts` section is only available when `includeSections=repsAndCerts` is included and the entity has an active registration. Inactive or non-registered entities return entity core data only. The route must handle graceful fallback (return name/CAGE/UEI even if certifications are unavailable).

---

### Feature 5: Version History

**Integration type:** New table + modified save flow in existing sections route + 2 new editor components.

**Key decision:** Do NOT use Tiptap's Snapshot extension — it is a Tiptap Cloud paid feature (confirmed at https://tiptap.dev/docs/editor/extensions/functionality/snapshot), requiring an external Tiptap collaboration server. Build custom lightweight snapshots using Postgres.

**New table:**

```sql
create table public.section_versions (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid not null references public.proposal_sections(id) on delete cascade,
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  saved_by        uuid references auth.users,    -- team member who triggered save
  content         jsonb not null,                -- full Tiptap JSON snapshot
  version_number  integer not null,              -- monotonic per section_id
  label           text,                          -- optional "Before legal review" label
  word_count      integer,                       -- precomputed for display
  created_at      timestamptz not null default now(),
  unique (section_id, version_number)
);
alter table public.section_versions enable row level security;

-- RLS: same dual-policy pattern as proposal_sections
create policy "Users can view own section_versions"
  on section_versions for select to authenticated
  using ((select auth.uid()) = user_id);

-- Pruning: keep last 50 versions per section to control storage
-- Run via pg_cron or trigger after insert
```

**Modified files:**
- `src/app/api/proposals/[id]/sections/route.ts` — on PATCH (save), check if content hash changed from last version; if changed, insert a `section_versions` row. Use `saved_by = auth.uid()` for team attribution.

**New routes:**
- `src/app/api/proposals/[id]/sections/[sectionId]/versions/route.ts` — GET list (last 20); DELETE prune; POST restore (copies a version's content back to `proposal_sections.content`)

**New components:**
- `src/components/editor/VersionHistoryPanel.tsx` — slide-in panel listing versions (timestamp, saved_by, word count, optional label). Restore button triggers POST to versions route.
- `src/components/editor/VersionDiffView.tsx` — shows before/after text diff. Implementation: convert two Tiptap JSON objects to plain text strings (walk nodes), then use `diff` npm package for unified diff display.

**Modified files:**
- `src/components/editor/EditorToolbar.tsx` — add "History" icon button

---

### Feature 6: Section Comments

**Integration type:** New table + new RLS + 3 new components + new API route + Realtime subscription.

**New table:**

```sql
create table public.section_comments (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid not null references public.proposal_sections(id) on delete cascade,
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  parent_id       uuid references public.section_comments(id) on delete cascade,
  author_id       uuid not null references auth.users on delete cascade,
  body            text not null check (char_length(body) <= 2000),
  resolved        boolean not null default false,
  resolved_by     uuid references auth.users,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.section_comments enable row level security;

-- Proposal owner access
create policy "Users can view own proposal comments"
  on section_comments for select to authenticated
  using (
    proposal_id in (select id from public.proposals where user_id = (select auth.uid()))
  );

-- Team member access (after team_memberships exists)
create policy "Team members can view comments"
  on section_comments for select to authenticated
  using (
    exists (
      select 1 from public.team_memberships tm
      where tm.proposal_id = section_comments.proposal_id
        and tm.user_id = (select auth.uid())
        and tm.accepted_at is not null
    )
  );

create policy "Proposal members can create comments"
  on section_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      proposal_id in (select id from public.proposals where user_id = (select auth.uid()))
      or exists (
        select 1 from public.team_memberships tm
        where tm.proposal_id = section_comments.proposal_id
          and tm.user_id = (select auth.uid())
          and tm.accepted_at is not null
      )
    )
  );
```

**New routes:**
- `src/app/api/proposals/[id]/sections/[sectionId]/comments/route.ts` — GET list, POST create
- `src/app/api/proposals/[id]/sections/[sectionId]/comments/[commentId]/route.ts` — PATCH (resolve/unresolve), DELETE

**New components:**
- `src/components/editor/CommentsPanel.tsx` — slide-in panel with threaded comment list, filter by section, unresolved-only toggle
- `src/components/editor/CommentThread.tsx` — root comment + reply list; resolve button
- `src/components/editor/CommentBadge.tsx` — unresolved count badge on section tab

**Modified files:**
- `src/components/editor/SectionEditor.tsx` — show CommentBadge, open CommentsPanel on click
- `src/components/editor/EditorToolbar.tsx` — add Comments toggle button

**Realtime:** Use `postgres_changes` on `section_comments` filtered by `proposal_id` — identical to existing `ProcessingStatus.tsx` pattern on `document_jobs`. No new Realtime channel setup required.

**Hard dependency:** Team accounts (Feature 1) should ship first for multi-user comment visibility to work correctly.

---

### Feature 7: Win/Loss Tracking

**Integration type:** New table + new API route + 2 new components + proposals status extension.

**New table:**

```sql
create table public.bid_outcomes (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null unique references public.proposals(id) on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  outcome         text not null
    check (outcome in ('won', 'lost', 'no_bid', 'pending', 'withdrawn')),
  submitted_at    timestamptz,
  result_date     timestamptz,
  award_amount    bigint,            -- cents; nullable (not always disclosed)
  loss_reason     text,              -- "price", "past performance", "scope"
  notes           text,
  predicted_score integer,           -- snapshot of win_score at submission time
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.bid_outcomes enable row level security;

create policy "Users can manage own bid_outcomes"
  on bid_outcomes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

**Schema change to proposals:** Extend status constraint:
```sql
alter table public.proposals drop constraint proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in ('draft','processing','ready','analyzed','submitted','failed','archived'));
```

**New routes:**
- `src/app/api/proposals/[id]/outcome/route.ts` — POST create, PATCH update outcome
- `src/app/(dashboard)/analytics/page.tsx` — contractor's own win/loss dashboard (win rate, loss reason breakdown, predicted vs. actual score correlation)

**New components:**
- `src/components/proposals/BidOutcomeForm.tsx` — outcome selector + optional fields (award amount, loss reason)
- `src/components/analytics/WinLossHistory.tsx` — outcome list with win rate summary and trend chart

**Modified files:**
- `src/app/(dashboard)/proposals/[id]/page.tsx` — show "Record Outcome" button when status = 'analyzed'

---

### Feature 8: Operator Dashboard

**Integration type:** New protected app section + aggregate queries via service_role + optional export_logs table.

**Auth pattern:** Use Supabase Auth `app_metadata`. Set `app_metadata: { role: 'hcc_admin' }` manually in Supabase dashboard for HCC admin users. `app_metadata` is not user-writable — safe without an extra table. Server Components check `user.app_metadata?.role === 'hcc_admin'` before proceeding.

**Data access:** All aggregate queries use `src/lib/supabase/admin.ts` (service_role client, already exists). Admin Server Components call it directly. Never pass admin client to Client Components.

**Optional new table for export tracking:**

```sql
create table public.export_logs (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  format       text not null check (format in ('docx', 'pdf')),
  exported_at  timestamptz not null default now()
);
-- NO RLS: service role reads only; no user-facing access
```

**Metrics available via aggregate queries:**
- Active users: distinct `user_id` in `proposals` created in last 30 days
- Proposals by status: `GROUP BY status` in `proposals`
- Export volume: `COUNT(*)` in `export_logs` grouped by format
- Subscription breakdown: `GROUP BY subscription_status` in `profiles`
- Win rate: `bid_outcomes GROUP BY outcome`

**New files:**
- `src/app/(dashboard)/admin/layout.tsx` — role guard (redirect if not hcc_admin)
- `src/app/(dashboard)/admin/page.tsx` — metrics Server Component, uses admin client
- `src/components/admin/MetricsGrid.tsx` — summary stat cards
- `src/components/admin/ProposalsByStatusChart.tsx` — bar chart
- `src/components/admin/RecentActivityTable.tsx` — latest proposals across all users
- `src/components/admin/SubscriptionBreakdown.tsx` — subscription status distribution

**Modified files:**
- `src/app/api/proposals/[id]/export/docx/route.ts` — insert to `export_logs` after successful export
- `src/app/api/proposals/[id]/export/pdf/route.ts` — insert to `export_logs` after successful export

---

## Schema Change Summary

### New Tables (v2.0)

| Table | Purpose | Depends On |
|-------|---------|-----------|
| `team_memberships` | Proposal-level RBAC (owner/editor/viewer) | proposals |
| `pending_invites` | Email invites pending acceptance | proposals |
| `section_versions` | Tiptap JSON snapshots for version history | proposal_sections, proposals |
| `section_comments` | Threaded comments per section, with resolution | proposal_sections, proposals |
| `bid_outcomes` | Win/loss tracking with predicted vs. actual score | proposals (unique) |
| `export_logs` | Operator dashboard export volume tracking | proposals (no RLS) |

### Column Additions to Existing Tables

| Table | New Column(s) | Purpose |
|-------|--------------|---------|
| `proposals` | `team_enabled boolean default false` | Solo vs. team mode flag |
| `proposals` | `govrfp_opportunity_id text` | GovRFP import back-link |
| `proposals` | `solicitation_number text` | Prefilled from GovRFP |
| `proposals` | `source_agency text` | Prefilled from GovRFP |
| `proposals` | `response_deadline timestamptz` | Prefilled from GovRFP |
| `proposals` | status constraint: add `'submitted'` | Bid lifecycle |

### New RLS Policies

| Table | Policy | Pattern |
|-------|--------|---------|
| `team_memberships` | Owner can manage, member can view self | `invited_by = auth.uid()` or `user_id = auth.uid()` |
| `proposal_sections` | Team members can SELECT | EXISTS in team_memberships |
| `proposal_sections` | Team editors can UPDATE | EXISTS in team_memberships + role in ('owner','editor') |
| `rfp_analysis` | Team members can SELECT | EXISTS in team_memberships |
| `section_versions` | Team members can SELECT | EXISTS in team_memberships |
| `section_comments` | Team members can SELECT/INSERT | EXISTS in team_memberships |
| `realtime.messages` | Proposal presence channel | EXISTS in proposals OR team_memberships |

---

## System Overview — v2.0

```
+------------------------------------------------------------------------+
|                    Next.js 16.2.1 App Router                           |
|                                                                         |
|  +------------------------+   +-------------------------------------+  |
|  |   Contractor App       |   |  HCC Admin App                      |  |
|  | proposals/[id]/editor  |   |  /admin/* (app_metadata role guard) |  |
|  | proposals/[id]/team    |   |  MetricsGrid / ActivityTable        |  |
|  | analytics/             |   +-------------------------------------+  |
|  +------------------------+                                            |
|                                                                         |
|  +----------------------------------------------------------------------+
|  |                    API Routes (new in v2.0)                          |
|  |  /api/govrgp/import         /api/sam/prefill                        |
|  |  /api/proposals/[id]/invites   /api/invites/accept                  |
|  |  /api/proposals/[id]/sections/[sId]/versions                        |
|  |  /api/proposals/[id]/sections/[sId]/comments                        |
|  |  /api/proposals/[id]/outcome                                         |
|  +----------------------------------------------------------------------+
|                                                                         |
+---------+----------------------------------+---------------------------+
          |                                  |
+---------v-----------+          +-----------v-----------+
|   Supabase          |          |   GovRFP Next.js App  |
|                     |          |   (contractor-rfp-    |
|  PostgreSQL (new)   |          |    website)           |
|  team_memberships   |          |                       |
|  pending_invites    |          |  /api/rfp-export/[id] |
|  section_versions   |          |  Authorization:       |
|  section_comments   |          |  Bearer shared-secret |
|  bid_outcomes       |          +-----------+-----------+
|  export_logs        |                      |
|                     |                      |
|  Realtime           |          +-----------v-----------+
|  Presence channel:  |          |   External APIs       |
|  proposal:{id}      |          |                       |
|  -> PresenceAvatars |          |  SAM.gov v3           |
|                     |          |  /entity-info/v3      |
|  postgres_changes:  |          |  1000 req/day         |
|  section_comments   |          |  system acct key only |
|  filtered by        |          +-----------------------+
|  proposal_id        |
|                     |
|  Auth Admin:        |
|  inviteUserByEmail()|
+---------------------+
```

---

## Component Responsibilities

| Component | Responsibility | New vs. Modified |
|-----------|---------------|-----------------|
| `PresenceAvatars` | Subscribe to presence channel, render avatar stack in editor header | NEW |
| `SectionPresenceIndicator` | Per-section presence dot when another user is active | NEW |
| `InviteModal` | Email + role input, calls POST /invites | NEW |
| `MemberList` | Display team members with role badges + remove action | NEW |
| `VersionHistoryPanel` | Slide-in list of snapshots with restore action | NEW |
| `VersionDiffView` | Client-side before/after text diff display | NEW |
| `CommentsPanel` | Slide-in threaded comment list with section filter | NEW |
| `CommentThread` | Root comment + replies + resolve button | NEW |
| `CommentBadge` | Unresolved count on section tab | NEW |
| `BidOutcomeForm` | Record win/loss outcome with metadata | NEW |
| `WinLossHistory` | Contractor's own outcome history and win rate | NEW |
| `MetricsGrid` | Admin aggregate stats cards (service_role queries) | NEW |
| `ProposalsByStatusChart` | Bar chart of proposals by status | NEW |
| `RecentActivityTable` | Latest proposals across all users (admin only) | NEW |
| `SubscriptionBreakdown` | Subscription status distribution chart | NEW |
| `ProposalEditor` | + mount PresenceAvatars + pass section focus to presence hook | MODIFIED |
| `SectionEditor` | + presence section tracking + CommentBadge mount | MODIFIED |
| `EditorToolbar` | + History button + Comments toggle | MODIFIED |
| `profile-form` | + SAM.gov prefill button next to UEI/CAGE field | MODIFIED |
| export routes (docx, pdf) | + insert to export_logs after success | MODIFIED |
| `proposals/[id]/page.tsx` | + Team tab + Record Outcome button | MODIFIED |

---

## Recommended Build Order

```
Phase 07 — Team Accounts (Feature 1)
  WHY FIRST: team_memberships table is a hard dependency for
  Presence authorization (Feature 2), Comments visibility (Feature 6),
  and Version History attribution (Feature 5). RLS policy changes to
  existing tables must be in place before any multi-user flows can work.
  UNBLOCKS: Features 2, 5, 6

Phase 08 — Parallel: Co-Editing Presence (Feature 2) + GovRFP Import (Feature 3)
  Co-Editing Presence:
    WHY HERE: Zero schema changes. team_memberships now exists.
    Realtime channel + 2 components. Highest visible UX value next.
  GovRFP Import:
    WHY HERE: Fully self-contained. Requires only proposals column
    additions and a new route. Parallel because it has no dependency
    on team accounts.
  NOTE: GovRFP import requires a coordinated deploy to both repos.

Phase 09 — Parallel: SAM.gov Prefill (Feature 4) + Version History (Feature 5)
            + Section Comments (Feature 6)
  SAM.gov Prefill:
    WHY HERE: Profile-only change. Blocks on obtaining SAM.gov
    system account key. Self-contained.
  Version History:
    WHY HERE: New table + modified save route. team_memberships
    exists so saved_by attribution works. No other deps.
  Section Comments:
    WHY HERE: New table. Uses existing postgres_changes Realtime
    pattern. team_memberships exists for visibility RLS.

Phase 10 — Win/Loss Tracking (Feature 7) + Operator Dashboard (Feature 8)
  Win/Loss Tracking:
    WHY HERE: Standalone new table. More data = more useful operator
    dashboard. Ship slightly before dashboard.
  Operator Dashboard:
    WHY LAST: Aggregate query layer on top of all other features.
    More useful with win/loss data present. Requires HCC admin
    app_metadata flag to be set in Supabase dashboard manually.
```

**Phase-to-migration mapping:**

| Phase | New Migration | Tables Changed |
|-------|--------------|----------------|
| 07 | `00005_team_accounts.sql` | team_memberships, pending_invites; proposals add team_enabled |
| 08 | `00006_govrgp_import.sql` | proposals add govrfp_opportunity_id, solicitation_number, source_agency, response_deadline; proposals status add 'submitted' |
| 09 | `00007_editor_enhancements.sql` | section_versions, section_comments |
| 10 | `00008_analytics.sql` | bid_outcomes, export_logs |

---

## Architectural Patterns

### Pattern 1: Dual-Policy RLS for Team Access

**What:** Tables with a single `user_id` owner policy gain a second SELECT policy (and optionally UPDATE) that checks `team_memberships` via EXISTS subquery.

**When to use:** Any table where team members need access. Always keep the original `user_id` policy — do not replace it.

**Trade-offs:** EXISTS subquery adds a database lookup per query. Mitigate with `create index on team_memberships (proposal_id, user_id)` and the `(select auth.uid())` cached subquery form.

### Pattern 2: Presence Over Broadcast for Awareness

**What:** Supabase Realtime Presence channel per proposal. Auto-cleans on disconnect. Payload tracks which section each user is editing.

**When to use:** "Who is currently here?" ephemeral state. Not persisted, not queryable.

**Trade-offs:** In-memory only. Acceptable for presence. Do not use Broadcast — it requires explicit leave messages and does not auto-clean.

### Pattern 3: Server-Side API Bridge with Shared Secret

**What:** ProposalAI calls GovRFP's export endpoint from a Next.js Route Handler (never from the browser). `Authorization: Bearer {GOVRGP_EXPORT_SECRET}` on every request.

**When to use:** Cross-origin integrations between two owned apps with separate Supabase projects.

**Trade-offs:** GovRFP must build and deploy the export endpoint. Secret rotation requires coordinated deploy to both apps.

### Pattern 4: Custom Postgres Snapshots vs. Tiptap Cloud

**What:** Full Tiptap JSON stored in `section_versions` on each meaningful save. Client-side diff of two JSON-to-text conversions.

**When to use:** Version history without Tiptap Cloud. Suitable for "compare and restore draft versions." Not for character-level keystroke replay.

**Trade-offs:** Snapshots are full copies (~10-50KB each). Must prune old versions. Cannot replay granular edits. Fully adequate for the stated use case.

### Pattern 5: app_metadata Role for Operator Access

**What:** HCC admin users have `app_metadata: { role: 'hcc_admin' }` set via Supabase dashboard. Server Components read `user.app_metadata?.role`. Admin queries use service_role client (`src/lib/supabase/admin.ts`).

**When to use:** Small number of known operators who need cross-tenant visibility. Too few to warrant a full RBAC table.

**Trade-offs:** Must manually set app_metadata in Supabase dashboard (no UI). Cannot be abused by users (app_metadata is write-protected by auth).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sharing Supabase Projects Between GovRFP and ProposalAI

**What people do:** Connect both apps to the same Supabase project for direct database cross-reads.

**Why it's wrong:** Conflicting RLS scopes (GovRFP data is public; ProposalAI data is private per-user). Schema coupling prevents independent deployment. Service role key sharing across apps is a security anti-pattern.

**Do this instead:** Server-to-server API bridge with shared secret (Pattern 3).

### Anti-Pattern 2: Using Tiptap Snapshot Extension

**What people do:** Install `@tiptap/extension-snapshot` for version history.

**Why it's wrong:** Confirmed Tiptap Cloud requirement — needs an external paid Tiptap collaboration server. Adds a service dependency and monthly cost not budgeted for v2.

**Do this instead:** Custom `section_versions` table (Pattern 4).

### Anti-Pattern 3: SAM.gov API Key Exposed Client-Side

**What people do:** Set `NEXT_PUBLIC_SAM_GOV_API_KEY` so the profile form can call SAM.gov directly.

**Why it's wrong:** System account keys have 1,000 req/day. Any user could inspect the key and exhaust the quota. SAM.gov terms of service prohibit key sharing.

**Do this instead:** All SAM.gov calls through `src/app/api/sam/prefill/route.ts` server-side only.

### Anti-Pattern 4: Replacing Existing RLS Policies for Team Access

**What people do:** Replace `(select auth.uid()) = user_id` with a team membership check on all tables.

**Why it's wrong:** Solo users who don't use team features still need the fast direct `user_id` path. Replacing with EXISTS queries slows every single query for all users.

**Do this instead:** Add a second policy alongside the existing one. PostgreSQL evaluates OR across policies automatically.

### Anti-Pattern 5: Running Admin Aggregates Through User RLS

**What people do:** Use the user's session token for operator dashboard queries.

**Why it's wrong:** RLS filters every query to the authenticated user's rows. Cross-tenant aggregates return only the operator's own data.

**Do this instead:** Admin dashboard Server Components always use `src/lib/supabase/admin.ts` (service_role). Gate the page with `app_metadata.role` check before calling admin client.

### Anti-Pattern 6: Viewer-Role Users Getting Write Access

**What people do:** Write one broad policy — "any accepted team member can SELECT and UPDATE."

**Why it's wrong:** Viewer role exists precisely for stakeholders who should not edit. One broad policy removes that distinction.

**Do this instead:** Separate policies per operation. SELECT: all accepted members. UPDATE/INSERT: `role in ('owner', 'editor')` only.

---

## Integration Points

### External Services

| Service | Integration Pattern | Auth | Constraint |
|---------|---------------------|------|-----------|
| SAM.gov Entity API v3 | Server Route Handler → `api.sam.gov/entity-information/v3` | `?api_key=` system account key, server-side only | 1,000 req/day; never expose to browser |
| GovRFP (`contractor-rfp-website`) | Server Route Handler → `{GOVRGP_BASE_URL}/api/rfp-export/[id]` | `Authorization: Bearer {GOVRGP_EXPORT_SECRET}` | GovRFP must build export endpoint; coordinate deploy |
| Supabase Auth Admin | `supabase.auth.admin.inviteUserByEmail()` | `SUPABASE_SERVICE_ROLE_KEY` (already in `admin.ts`) | Email invite for new users; existing users get direct team_memberships insert |
| Supabase Realtime Presence | `supabase.channel('proposal:{id}').on('presence').track()` | PKCE JWT + realtime.messages RLS | Ephemeral; presence state lost on disconnect |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Team accounts → Presence auth | `realtime.messages` RLS queries `team_memberships` | Presence channel join fails until team_memberships table exists |
| Team accounts → Comments | `section_comments` RLS queries `team_memberships` | Visibility policy depends on team_memberships |
| Team accounts → Version history | `section_versions.saved_by` FK | Attribution only; does not block version history for solo users |
| Win/loss → Operator dashboard | `bid_outcomes` aggregate via service_role | Operator dashboard is more useful after win/loss ships |
| GovRFP import → proposals | Prefills 4 new columns; existing upload+analysis flow unchanged | New proposal goes through the same document_jobs queue |
| SAM.gov prefill → profiles | Overwrites `certifications[]` and `uei_cage` only with user confirmation | Profile injection into drafts (Phase 3) benefits immediately |

---

## Scaling Considerations

At current user base (HCC members + small contractors), all patterns above hold without modification.

| Scale | Architecture Notes |
|-------|--------------------|
| 0-1k users | All patterns above are appropriate. Presence channels per proposal are cheap. |
| 1k-10k users | Index `team_memberships(proposal_id, user_id)` is critical (already listed). Monitor Supabase Realtime concurrent connection limit on current plan tier. Add SAM.gov response caching in Redis/Upstash to reduce daily API calls if users refresh frequently. |
| 10k+ users | Partition `section_versions` by `proposal_id` if table grows large. Consider background cleanup job for expired `pending_invites`. Operator dashboard queries may need materialized views for sub-second response at high row counts. |

---

## Sources

- Supabase Realtime Presence API: https://supabase.com/docs/guides/realtime/presence
- Supabase Realtime Authorization (RLS on realtime.messages): https://supabase.com/docs/guides/realtime/authorization
- Supabase Auth inviteUserByEmail: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- Supabase RBAC with RLS: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- SAM.gov Entity Management API v3: https://open.gsa.gov/api/entity-api/
- Tiptap Snapshot extension (Tiptap Cloud required, confirmed): https://tiptap.dev/docs/editor/extensions/functionality/snapshot
- Existing codebase migrations: `/c/Users/glcar/hcc-proposal-ai/supabase/migrations/` (00001-00004)
- GovRFP schema and app structure: `/c/Users/glcar/contractor-rfp-website/`

---

*Architecture research for: HCC ProposalAI v2.0 — 8 new features integration*
*Researched: 2026-03-25*
