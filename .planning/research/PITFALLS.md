# Pitfalls Research

**Domain:** Adding team accounts, real-time presence, external API integrations, and analytics to an existing solo SaaS (Supabase + Next.js + Stripe)
**Researched:** 2026-03-25
**Confidence:** HIGH — all critical pitfalls grounded in the existing codebase schema, official Supabase/Stripe/SAM.gov documentation, and verified patterns from multi-tenant architecture sources

---

## Critical Pitfalls

### Pitfall 1: RLS Policy Explosion — Every Existing Table Breaks When team_id Lands

**What goes wrong:**
Every table in the existing schema uses `(select auth.uid()) = user_id` as its RLS policy. Adding team accounts means a proposal can be owned by a team, but the team member's `auth.uid()` will not match the `user_id` on `proposals`, `document_jobs`, `rfp_analysis`, `proposal_sections`, `past_projects`, or `key_personnel`. The result: all existing API routes, Edge Functions, and server actions return empty result sets or 403s the moment a user joins a team. The error is silent — Supabase RLS returns zero rows, not an error message, so the UI renders "no proposals" instead of crashing.

**Why it happens:**
Team account features are planned as "add-on" work. The developer writes the `team_members` table and invite flow, then forgets that every policy touching `proposals` now needs to allow access via team membership — not just via direct ownership. The solo-user path still works (because `user_id = auth.uid()` still matches for the original owner), so the problem only appears when a second user accepts an invite.

**How to avoid:**
Design the RLS migration before writing a single line of invite-flow code. The new policy pattern for proposals is:

```sql
-- Allow solo owners AND team members
create policy "Users can access proposals via ownership or team membership"
  on proposals for select to authenticated
  using (
    user_id = (select auth.uid())
    or
    exists (
      select 1 from team_members
      where team_members.proposal_id = proposals.id
        and team_members.user_id = (select auth.uid())
        and team_members.status = 'active'
    )
  );
```

This pattern must be applied consistently to: `proposals`, `document_jobs`, `rfp_analysis`, `proposal_sections`. Tables that remain per-user (`past_projects`, `key_personnel`, `profiles`) do NOT need updating — they stay solo-scoped intentionally.

The team membership check via `exists()` subquery will be called on every row fetch. Index `team_members(proposal_id, user_id)` — without it, the subquery scans the entire `team_members` table per row.

**Warning signs:**
- Second invited user can authenticate but sees zero proposals
- API routes return 200 with empty arrays instead of expected data
- No test covering a cross-user team member access scenario

**Phase to address:** Team Accounts phase — must be the first migration written in v2.0, before any invite UI code

---

### Pitfall 2: Stripe Quantity Mismatch — Seats in DB Diverge from Seats in Stripe

**What goes wrong:**
The current billing model is one subscription per `profiles.stripe_subscription_id`, priced per-seat. Adding team accounts means the subscription quantity must equal the number of active team members. When a team member is invited and accepts, the Stripe subscription quantity must be incremented. When a member is removed, it must be decremented. If this update is missed — or if it fires on invite rather than on acceptance — the quantity in Stripe does not match the actual seat count. Users can over-provision free seats (invite 10 people, only pay for 1), or worse, get double-charged (quantity incremented twice due to webhook retry).

**Why it happens:**
The invite flow has two async steps: invite sent → invite accepted. Developers increment the Stripe quantity at invite time (not at acceptance) because that is the simpler code path. Stripe webhook retries compound this: if the seat increment API call succeeds but the webhook processing fails, the increment may fire again on retry without an idempotency check.

**How to avoid:**
- Increment Stripe subscription quantity only on invite acceptance, not on invite send.
- Use `stripe.subscriptions.update({ quantity: newCount, proration_behavior: 'create_prorations' })` — always set `proration_behavior` explicitly; Stripe's default can vary by subscription configuration.
- Before the update, read the current live quantity from Stripe directly (not from the DB cache) to compute the delta — this prevents drift if DB and Stripe fell out of sync.
- Add an idempotency key tied to the `team_member_id` + action to prevent double-increments on webhook retry.
- Enforce a DB-side seat limit check before accepting an invite: if `active_member_count >= subscription_quantity`, block the invite acceptance and return a clear error.
- Run a nightly reconciliation job that compares `count(active team members per team)` against `stripe subscription quantity` and alerts on mismatch.

**Warning signs:**
- Stripe subscription quantity is 1 but team has 4 active members
- Removing a team member does not trigger a Stripe quantity decrement
- No idempotency table entry for seat change events

**Phase to address:** Team Accounts phase — billing mutation logic must be designed alongside the invite acceptance flow

---

### Pitfall 3: Supabase Realtime Channel Authorization Hole — Team Members Can Join Any Proposal Channel

**What goes wrong:**
The existing presence setup for document processing uses `Realtime Postgres Changes` filtered by `proposal_id`. The new real-time co-editing presence (showing who is viewing/editing a proposal) uses Supabase Realtime Broadcast or Presence channels. Without `private: true` on the channel and corresponding `realtime.messages` RLS policies, any authenticated user who knows a `proposal_id` UUID can join that channel and observe presence data — who is working on which proposal, when, and from what cursor position. Proposal IDs are predictable UUIDs; they appear in the URL bar.

**Why it happens:**
Supabase Realtime channels are public by default. The developer tests presence with their own user account, confirms it works, and ships. The RLS on the data tables is correct, but the Realtime channel itself has no authorization layer.

**How to avoid:**
Use the `private: true` channel option (requires `supabase-js` v2.44.0+) and add explicit `realtime.messages` RLS policies:

```sql
-- Only team members with active membership can access the channel
create policy "Team members can join proposal presence channels"
  on realtime.messages for all to authenticated
  using (
    (realtime.topic() = 'proposal:' || (payload->>'proposal_id'))
    and exists (
      select 1 from proposals p
      where p.id = (payload->>'proposal_id')::uuid
        and (
          p.user_id = (select auth.uid())
          or exists (
            select 1 from team_members tm
            where tm.proposal_id = p.id
              and tm.user_id = (select auth.uid())
              and tm.status = 'active'
          )
        )
    )
  );
```

Note: Realtime Authorization is in Public Beta as of 2025. Verify it is available on your Supabase plan before relying on it.

**Warning signs:**
- Channel created without `{ private: true }` option
- No `realtime.messages` RLS policies in any migration file
- Presence channel topic is just `proposal_id` with no access check

**Phase to address:** Real-time Presence phase — authorization must be implemented before the channel goes live

---

### Pitfall 4: Real-time Presence Is Not Real-time Co-editing — Scope Creep Trap

**What goes wrong:**
The v2.0 spec says "real-time co-editing indicators (presence awareness)" — which means showing a cursor or avatar indicating another user is viewing/editing the proposal. This is categorically different from actual collaborative editing with conflict resolution (like Google Docs). If the team conflates presence indicators with collaborative editing during implementation, they will scope-creep into integrating Tiptap Collaboration (Hocuspocus server + Yjs CRDT) — a completely different infrastructure requirement that adds a dedicated WebSocket server, changes how Tiptap content is stored (Yjs binary vs JSON), and invalidates the existing `proposal_sections.content` JSONB storage model.

**Why it happens:**
Both features use Supabase Realtime and Tiptap. The names overlap. Developers start with "let me show who is editing" and end up implementing full Yjs sync because it "felt necessary." The blog post "I Built a Full-Stack Real-Time Collaborative Rich Text Editor with React + Tiptap + Y.js" is the gateway drug.

**How to avoid:**
Define the exact contract before writing code:
- **Presence awareness (v2.0 scope):** User avatar + name shown in proposal header when another user has the proposal open. Last-seen cursor section (not cursor position). No conflict resolution. Users save separately; last write wins on section save.
- **Full co-editing (v3.0+ if ever):** Yjs CRDT, Hocuspocus server, cursor position sync, real-time character-level merges. Requires new server infrastructure and a JSONB → Yjs document migration.

Implement presence using Supabase Realtime Presence only (no Yjs). The presence state payload is `{ user_id, user_name, proposal_id, active_section }` — nothing about document content. Tiptap content storage stays as JSONB `proposal_sections.content`.

**Warning signs:**
- Any mention of `y-protocols`, `hocuspocus`, or `@tiptap/extension-collaboration` in the feature spec
- Implementation plan includes a new WebSocket server or Fly.io deployment
- JSONB content storage is being reconsidered for "Y.js binary format"

**Phase to address:** Real-time Presence phase — define scope contract explicitly at plan-writing time as a success criterion

---

### Pitfall 5: Version History Storage Blowout — Snapshotting Full Tiptap JSON Per Edit

**What goes wrong:**
Version history stores snapshots of `proposal_sections.content` (Tiptap JSON JSONB). A single section's Tiptap JSON for an AI-drafted Technical Approach is typically 15–40KB. If snapshots are taken on every save (30-second auto-save fires continuously), a single proposal accumulates 30KB × 120 saves/hour × 8 hours = ~28MB in version snapshots per proposal per day. At 100 active proposals, that is 2.8GB/day of version data. Supabase database storage costs money; more importantly, fetching version history for comparison requires loading multiple 30KB JSONB blobs per query.

**Why it happens:**
Developers copy the auto-save trigger pattern and add a `version_snapshots` insert alongside each save. It works fine in testing (where nobody edits for hours). The problem surfaces only when actual users edit proposals over a full workday.

**How to avoid:**
Do not snapshot on every auto-save. Snapshot on explicit user action only (manual "Save version" button) plus one automatic snapshot per session (on first edit after idle for >30 minutes). This limits snapshots to a realistic 5–20 per proposal lifetime.

Add a `max_versions` ceiling per proposal (e.g., 50 versions). When exceeded, delete the oldest non-manually-named versions first. Display a "version history is approaching limit" notice in the UI.

Store the diff, not the full snapshot, for minor versions: compute a JSON diff between the previous version and the current content, store only the patch. The full Tiptap JSON is only stored for major versions (manual saves). This requires a `json-diff` or `jiff` library; test it with real Tiptap JSON structures before committing to the approach.

**Warning signs:**
- `version_snapshots` table has an insert trigger on `proposal_sections updated_at`
- No `max_versions` enforcement in code
- No compression or diff strategy in the version snapshot schema

**Phase to address:** Version History phase — storage strategy must be decided before the schema migration is written

---

### Pitfall 6: SAM.gov API Key Rotation Breaks Production Without Warning

**What goes wrong:**
SAM.gov individual account API keys expire every 90 days. A new key is auto-generated before the old one expires, but you must log into SAM.gov, retrieve the new key, and update your environment variable. If the rotation is missed, all SAM.gov entity prefill requests return 401 errors. The feature silently stops working. Users get no error — the prefill just doesn't populate — and file a support ticket a week later when they notice their certifications are empty.

**Why it happens:**
The 90-day rotation is not standard SaaS API key behavior. Most APIs use non-expiring keys or OAuth. The developer sets the key in Vercel environment variables at launch and forgets. There is no automated alert when a 401 response arrives from SAM.gov.

**How to avoid:**
- Use a SAM.gov System Account (not an individual account) if the application qualifies. System account keys also have rotation requirements, but the rotation process is more predictable and can be tied to a service identity rather than a personal login.
- Store the key expiry date in an environment variable (`SAM_GOV_KEY_EXPIRES_AT`) and add a server-side health check that returns a warning when the key is within 14 days of expiry.
- Add structured error handling on every SAM.gov API call: catch 401 responses specifically, log them to a monitoring table, and surface a UI fallback message ("Entity data unavailable — enter certifications manually") rather than silently failing.
- Set a calendar reminder at the time of initial setup, and document the rotation procedure in the project CLAUDE.md.

**Warning signs:**
- SAM.gov API key stored only in Vercel environment variables with no expiry tracking
- No 401 error handling distinct from other SAM.gov errors
- No health-check endpoint for external API credential validity

**Phase to address:** SAM.gov Integration phase — rotation handling must be designed before the integration goes live

---

### Pitfall 7: SAM.gov Rate Limits (10 req/day Public, 1000 req/day Registered) Kill Multi-User Prefill

**What goes wrong:**
The SAM.gov Entity Management API enforces hard rate limits: public (no API key) = 10 requests/day; individual account = 1,000 requests/day; federal system account = 10,000/day. At 1,000/day, a team of 10 users each running SAM.gov prefill 3 times per day = 30 requests. That sounds fine — until you realize 1,000/day is per API key, shared across all users of the application. A single burst of contractor profile setup (e.g., 50 HCC members onboarding in a week) can exhaust the daily limit and lock out all prefill requests until midnight UTC.

**Why it happens:**
Developers test SAM.gov prefill with their own UEI number, confirm it works, and ship. The 1,000/day limit sounds enormous for one developer. It is not enormous for 100 active users.

**How to avoid:**
- Cache SAM.gov entity data in the `profiles` table after first successful fetch: `sam_entity_data jsonb`, `sam_fetched_at timestamptz`. On prefill request, return cached data if `sam_fetched_at` is within 30 days and the user has not explicitly requested a refresh.
- Add a SAM.gov API call counter in the database (`api_rate_tracking` table) and enforce a daily budget check before issuing requests.
- For multi-user teams, a single SAM.gov entity lookup for the company (by UEI) should populate all team members' profiles — not one lookup per user.
- Surface a graceful fallback: if the daily limit is hit, present a message "SAM.gov data temporarily unavailable — certifications can be entered manually" with the manual profile fields pre-focused.

**Warning signs:**
- SAM.gov API called on every page load of the contractor profile
- No caching of entity data in `profiles` table
- No rate limit error handling separate from other SAM.gov errors

**Phase to address:** SAM.gov Integration phase — caching strategy must precede launch

---

### Pitfall 8: GovRFP Cross-Product API Trust Boundary — Shared Secret Without Scope Enforcement

**What goes wrong:**
GovRFP (`contractor-rfp-website`) sends RFP data to ProposalAI via a "one-click import" API call. The two products need to authenticate to each other. A naive implementation shares a single secret key (`GOVRFP_SHARED_SECRET`) that, if leaked, allows any caller to inject arbitrary RFP data into any user's ProposalAI account. Worse: if the shared secret is hardcoded in the GovRFP front-end JavaScript bundle, it is exposed to every user's browser DevTools.

**Why it happens:**
The two products are owned by the same team. The developer thinks "it's our own system, a shared secret is fine." The key ends up in a `fetch()` call in the browser because the developer put the integration in a client component.

**How to avoid:**
- The import call must be server-to-server only. GovRFP's API routes call ProposalAI's API routes — never from GovRFP's browser client.
- Use a signed JWT rather than a raw shared secret. GovRFP signs a payload containing `{ user_id, rfp_id, issued_at }` with a private key. ProposalAI verifies the signature with the corresponding public key. A compromised token is time-limited, not indefinitely valid.
- Scope the incoming RFP data strictly: the import endpoint must only create a new proposal row for the authenticated ProposalAI user — it cannot update existing proposals, modify other users' data, or bypass RLS.
- Add an allowlist of permitted source IPs or domains (the GovRFP Vercel deployment URL) to the ProposalAI import endpoint, as an additional layer.

**Warning signs:**
- `GOVRFP_SHARED_SECRET` referenced in a client component or `'use client'` file
- Import endpoint does not verify a time-bound signature
- Import endpoint uses `service_role` Supabase client rather than performing the insert as the target user

**Phase to address:** GovRFP Integration phase — authentication design must precede any import endpoint code

---

### Pitfall 9: RBAC Ghost Permissions — Viewer Role Can Still Trigger AI Regeneration

**What goes wrong:**
The team account RBAC spec says owner / editor / viewer. In practice, every API route that performs a mutating action (AI section regeneration, export, save) checks `isSubscriptionActive()` but not the caller's team role. A viewer-role team member can call `POST /api/proposals/[id]/regenerate` directly (bypassing the UI, which hides the button) and trigger a billable AI generation. The owner is charged for AI tokens used by a viewer.

**Why it happens:**
Role enforcement is added to the UI first (hide the button), then forgotten at the API layer. Developers assume users won't bypass the UI.

**How to avoid:**
Define a server-side role check utility early in the Team Accounts phase:

```typescript
// lib/team/role-check.ts
async function requireProposalRole(
  proposalId: string,
  minRole: 'viewer' | 'editor' | 'owner'
): Promise<void>
```

Call this utility at the top of every mutating API route handler and Edge Function, before any business logic runs. The check queries the `team_members` table (or `proposals.user_id` for solo ownership) and throws a 403 if the authenticated user's role is below the required minimum.

Write tests for the unauthorized cases specifically — these are the paths that break in production.

**Warning signs:**
- API routes check `isSubscriptionActive()` but never check team role
- Role enforcement only exists in client component conditional rendering
- No server-side role check utility function exists

**Phase to address:** Team Accounts phase — role check utility must be written before the first protected route

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Snapshot Tiptap JSON on every auto-save | Simple — reuse existing auto-save hook | Database storage blowout; 28MB/proposal/day at normal edit velocity | Never — snapshot on explicit save + session boundary only |
| Check team membership via DB subquery in RLS (no custom JWT claims) | Simpler setup, no auth hook required | 1 extra DB round-trip per row fetched; noticeable at >500 proposals per team | Acceptable for v2.0 scale (<1000 users); migrate to JWT claims at scale |
| Hardcode GovRFP shared secret as env var | Fast to ship | Single compromised secret gives full import access with no scope limit | Never — use signed time-limited tokens |
| Cache SAM.gov entity data in memory (not DB) | Avoids extra DB column | Lost on Vercel cold start; re-fetches on every new serverless instance | Never — persist cache to DB |
| Enforce seat limits only in UI (not server) | Faster to build | Users bypass limit via API; over-provision seats without paying | Never — enforce at DB level |
| Use `public` Realtime channels for presence (skip authorization) | Faster to ship | Any authenticated user can observe which proposals competitors are working on | Never in production |
| Increment Stripe seat count at invite-send time | Simpler — one event to handle | Double charges if invite is declined and re-sent; mismatch on pending invites | Never — only increment on acceptance |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SAM.gov API | Use individual account key with no expiry monitoring | Use system account if possible; track expiry date; alert 14 days before rotation |
| SAM.gov API | Fetch entity data on every profile page load | Cache in `profiles.sam_entity_data` with `sam_fetched_at`; refresh on explicit user action |
| SAM.gov API | No handling for partial entity records (SAM registration incomplete) | Check for `registrationStatus == 'Active'` before using data; surface clear message for inactive/expired registrations |
| GovRFP import | Server-to-server call uses raw shared secret | Sign payload with private key; verify with public key; enforce 5-minute token TTL |
| GovRFP import | Import creates proposal in GovRFP owner's account, not the ProposalAI user's account | Import endpoint must authenticate the ProposalAI user independently; GovRFP identity is used only to validate the payload signature |
| Stripe per-seat | Update subscription quantity using current DB count | Read live quantity from Stripe API before computing delta; DB is a cache, Stripe is truth |
| Stripe per-seat | No proration behavior set on quantity update | Always set `proration_behavior: 'create_prorations'` explicitly |
| Supabase Realtime | Channel topic is bare `proposal_id` UUID | Prefix topic with resource type: `proposal:${id}` to enable topic-scoped RLS policies |
| Supabase Realtime | Presence channel created without `private: true` | Set `private: true` on all presence channels; requires supabase-js v2.44.0+ |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Team membership check in RLS without index | Slow proposal list queries; timeout on teams with >20 proposals | Index `team_members(proposal_id, user_id)` and `team_members(user_id, status)` | ~50 team members |
| Fetching all version snapshots to render history list | Version history page takes >2s to load | Store `created_at`, `created_by`, `label` in a separate `version_metadata` table; load full JSONB only when user selects a specific version to compare | ~20 snapshots per proposal |
| Supabase Realtime channels per open browser tab | User with 3 tabs open creates 3 separate presence entries for the same user | Deduplicate presence by `user_id` on the client before rendering; use channel state to track own presence | Teams of 5+ with multi-tab users |
| Win/loss analytics aggregation query scans all proposals | Operator dashboard loads slowly; proposal table full scan | Create `proposals_analytics` materialized view refreshed hourly; query the view not the raw table | ~500 proposals total |
| SAM.gov entity fetch blocks profile page render | Profile page shows loading spinner for 1–3 seconds on every load | Fetch SAM entity data asynchronously in the background; render profile form immediately with cached data | Every profile page load without caching |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Viewer-role team member bypasses UI and calls AI regeneration endpoint | Billable AI usage charged to team owner without consent; abuse vector | Server-side role check in every mutating API route handler — not just in UI |
| GovRFP import endpoint accepts any payload signed with a long-lived secret | Replayed or forged imports inject malicious RFP data into user accounts | Time-limited signed tokens (5-minute TTL); idempotency key per import to prevent replay |
| Team member can access proposals after being removed from team | Former employee or contractor retains read access to active proposals | RLS policy checks `status = 'active'`; removing a member sets `status = 'removed'`, immediately invalidating their session access |
| SAM.gov entity data stored without field validation | Malformed NAICS codes or certification strings corrupt contractor profiles | Validate SAM.gov response against known schema (NAICS codes are 6 digits, certification types are from a fixed enum) before writing to DB |
| Operator dashboard exposes per-user proposal data to HCC admins | Privacy violation; contractor competitive information visible to HCC staff | Operator dashboard shows aggregate counts only (proposals drafted, exports, active users); never individual proposal titles, RFP content, or proposal text |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Presence indicator shows stale "online" state after user closes tab | Team members think a collaborator is actively editing when they left hours ago | Use Supabase Realtime Presence heartbeat with a 30-second TTL; mark users offline after 60 seconds of no heartbeat |
| Invite email lands in spam (from Supabase default SMTP) | New team members never accept invites; owner sees pending invites for weeks | Configure custom SMTP domain for Supabase before enabling team invites; test with real email addresses |
| Version history diff renders raw Tiptap JSON instead of readable text | Users cannot understand what changed between versions | Render diff as formatted prose (inserted text highlighted green, deleted text red), not raw JSON |
| "Owner" label on proposals is the original uploading user, not the team name | Confusion when proposals are assigned to a team | Display team name + role in proposal metadata; owner is the team, not a person |
| SAM.gov prefill silently does nothing when entity not found | Contractor is confused why certifications did not populate | Show explicit "No active SAM.gov registration found for UEI [X]. Enter certifications manually." — never silent no-op |

---

## "Looks Done But Isn't" Checklist

- [ ] **Team RLS:** Log in as team member (non-owner), verify proposals are accessible; verify document_jobs, rfp_analysis, and proposal_sections are also accessible via team membership (not just proposals table)
- [ ] **Team RLS (negative):** Remove a team member, verify their session loses access immediately without requiring re-login
- [ ] **Stripe seat sync:** Invite 3 users, accept all invites, verify Stripe subscription quantity = 4 (owner + 3); remove 1 member, verify quantity = 3
- [ ] **Stripe idempotency:** Replay the seat-increment webhook event; verify quantity does not double-increment
- [ ] **Viewer role enforcement:** As viewer, make a direct `curl` POST to `/api/proposals/[id]/regenerate`; verify 403 response (not a UI test — test the API directly)
- [ ] **Realtime channel authorization:** As an authenticated user with no team membership, attempt to join `proposal:[id]` presence channel for a proposal you don't own; verify rejection
- [ ] **SAM.gov 401 handling:** Intentionally expire the SAM.gov API key, trigger a prefill; verify graceful UI fallback (not a 500 error)
- [ ] **SAM.gov caching:** Trigger prefill twice in succession; verify second call uses cached data (check DB `sam_fetched_at` was not updated on second call)
- [ ] **Version history storage:** Edit a proposal for 15 minutes with auto-save running; verify fewer than 5 snapshots were created (not one per auto-save)
- [ ] **GovRFP import replay attack:** Replay the same signed import payload after the 5-minute TTL; verify the import is rejected
- [ ] **Operator dashboard data scope:** As HCC operator, verify dashboard shows aggregate counts only — no individual contractor names, proposal titles, or RFP content

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS policies broken for team members (existing users see no data) | HIGH | Write corrected RLS policies; apply as emergency migration; test all tables; if Supabase RLS cache is stale, force token refresh for all active sessions via Supabase Auth admin API |
| Stripe seat quantity out of sync across all teams | MEDIUM | Write a reconciliation script: for each team, count active members, compare to Stripe quantity, update Stripe where different; log all corrections; email affected team owners |
| SAM.gov API key expired in production | LOW | Log into SAM.gov, retrieve new key, update Vercel environment variable, redeploy (minutes); add expiry alert to prevent recurrence |
| Version snapshot storage blowout (GB of JSONB) | MEDIUM | Write a migration that deletes all auto-snapshots older than 90 days except the 5 most recent per proposal; add retention policy going forward; total cost: 1 migration + DB downtime |
| GovRFP import replay attack exploited | HIGH | Rotate shared secret immediately; audit `proposals` table for unexpected imports (check `created_via = 'govrfp_import'` column); delete injected proposals; implement time-limited tokens |
| Team member retains access after removal (RLS policy bug) | HIGH | Patch RLS policy immediately (emergency migration); audit `document_jobs` and `proposal_sections` for unauthorized reads via Postgres audit log; notify affected teams |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS policy explosion — all tables break for team members | Team Accounts (Phase 7) | Cross-user access test: non-owner team member can read proposals, document_jobs, rfp_analysis, proposal_sections |
| Stripe seat quantity divergence | Team Accounts (Phase 7) | Stripe subscription quantity matches active team member count after add + remove + re-add cycle |
| Realtime channel authorization hole | Real-time Presence (Phase 8) | Unauthorized user cannot join private proposal presence channel |
| Presence scope creep into full co-editing | Real-time Presence (Phase 8) | Success criteria in phase plan explicitly defines "presence indicators only — no Yjs, no Hocuspocus" |
| Version history storage blowout | Version History (Phase 9 or combined Editor Enhancements) | After 60 minutes of editing with auto-save, verify snapshot count is <5 |
| SAM.gov key rotation breaks production | SAM.gov Integration phase | Health check endpoint returns warning when key is within 14 days of expiry |
| SAM.gov rate limit exhaustion | SAM.gov Integration phase | Second identical prefill request within 30 days returns cached data without API call |
| GovRFP cross-product trust boundary | GovRFP Integration phase | Replayed import token rejected after TTL; import endpoint returns 403 without valid signature |
| RBAC ghost permissions | Team Accounts (Phase 7) | Viewer-role direct API call to mutating endpoint returns 403 |
| Operator dashboard privacy violation | Operator Dashboard phase | Dashboard response payload contains no individual proposal titles, names, or RFP content |

---

## Sources

- [Supabase RLS Best Practices — makerkit.dev](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase RLS Performance Best Practices — official docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Custom Claims and RBAC — official docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Realtime Authorization — official docs](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Realtime Limits — official docs](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime Presence — official docs](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime Broadcast and Presence Authorization — official blog](https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization)
- [Stripe Per-Seat Pricing — official docs](https://docs.stripe.com/subscriptions/pricing-models/per-seat-pricing)
- [Stripe Subscription Quantities — official docs](https://docs.stripe.com/billing/subscriptions/quantities)
- [Stripe Per-Seat Team Billing — makerkit.dev recipe](https://makerkit.dev/recipes/per-seat-stripe-subscriptions)
- [SAM.gov Entity Management API — GSA Open Technology](https://open.gsa.gov/api/entity-api/)
- [SAM.gov API Rate Limits — govconapi.com 2026](https://govconapi.com/sam-gov-rate-limits-reality)
- [SAM.gov API Key Usage — api.sam.gov official](https://api.sam.gov/docs/api-key/)
- [SAM.gov On-Going Key Rotation — GSA GitHub issue](https://github.com/GSA/889-tool/issues/6)
- [Tiptap Snapshot Extension — official docs](https://tiptap.dev/docs/collaboration/documents/snapshot)
- [Tiptap Collaboration Overview — official docs](https://tiptap.dev/docs/collaboration/getting-started/overview)
- [Lies I Was Told About Collaborative Editing — moment.dev (why not to use Yjs for simple presence)](https://www.moment.dev/blog/lies-i-was-told-pt-2)
- [Multi-Tenant Architecture with Supabase RLS — LockIn case study](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [Supabase Multi-Tenant RLS — antstack.com](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- Existing codebase schema: `supabase/migrations/00001_foundation_schema.sql` through `00004_proposal_sections.sql`

---
*Pitfalls research for: v2.0 feature additions — team accounts, real-time presence, GovRFP integration, SAM.gov prefill, version history, comments, win/loss tracking, operator dashboard*
*Researched: 2026-03-25*
