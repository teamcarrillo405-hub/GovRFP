# Phase 7: Team Accounts + RBAC - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-user access to the currently solo-user app. Proposals can be shared with teammates who view or edit based on their assigned role (editor / viewer). The team owner controls membership and roles. Every subsequent v2.0 phase (presence, comments, version history) depends on the team model established here.

Out of scope for this phase: real-time presence indicators (Phase 8), section comments (Phase 10), version history (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Proposal Ownership Model
- **D-01:** Add a nullable `team_id` FK to the `proposals` table — a proposal belongs to one team (or remains solo if `team_id` is NULL)
- **D-02:** RLS on `proposals` becomes dual-policy: `auth.uid() = user_id` (solo) OR user is a member of `team_id` (team access)
- **D-03:** The RLS dual-policy migration is the **first artifact** of Phase 7 — all other work depends on it
- **D-04:** Existing solo proposals are unaffected — `team_id` is nullable, no data migration needed

### Invite UX Entry Point
- **D-05:** Sharing starts from a **"Share" button on the proposal page** — proposal-first flow
- **D-06:** Clicking "Share" opens a modal/panel where the owner creates a team (if none exists) and invites teammates by email + role in one step
- **D-07:** No separate account-level "Team settings" page in Phase 7 — team management (change role, remove member) is accessible from the proposal share panel

### Invite Email Delivery
- **D-08:** Use Supabase `supabase.auth.admin.inviteUserByEmail(email, { data: { team_id, role, invite_id } })` — zero-config, no new email service required
- **D-09:** On accept: invited user lands in the app, invite record is marked accepted, proposal becomes visible in their dashboard
- **D-10:** On decline: user clicks a decline link (custom route) that marks the invite as declined and removes any pending DB record

### Seat Billing (v2 scope)
- **D-11:** Track seat count in the DB only — no Stripe subscription quantity changes in v2
- **D-12:** TEAM-07 is fulfilled by recording seat counts in DB (e.g., `teams.seat_count` or derived from `team_members` count) — Stripe per-seat billing is deferred to v3
- **D-13:** Team members do not need their own Stripe subscription — they access proposals through the owner's team

### Role Enforcement
- **D-14:** Build a `requireProposalRole(proposalId, minRole)` server utility in `src/lib/auth/proposal-role.ts` — called at the top of every mutating API route and Server Action that touches proposal data
- **D-15:** Roles: `owner` (full control) > `editor` (can edit proposal content) > `viewer` (read-only)
- **D-16:** Server-side enforcement is canonical — client UI reflects role state but a viewer calling a mutating route directly must receive a 403

### Claude's Discretion
- Exact SQL schema for `teams`, `team_members`, `team_invites` tables
- Invite token structure and expiry (Supabase handles this via `inviteUserByEmail`)
- Exact modal/panel component design for the Share flow
- How `requireProposalRole()` reads team membership (direct query vs. helper)

</decisions>

<specifics>
## Specific Ideas

- The "Share" button should live in the proposal page header/toolbar — visible but not dominant for solo users who haven't shared yet
- Invite accept flow: Supabase magic link → lands on `/invite/accept?token=...` route → marks invite accepted → redirects to the proposal

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TEAM-01 through TEAM-07 acceptance criteria (note: TEAM-07 is DB-only in v2, no Stripe quantity sync)
- `.planning/ROADMAP.md` — Phase 7 goal, success criteria, and dependency chain (Phase 8 depends on team membership established here)

### Existing Schema to Extend
- `supabase/migrations/00001_foundation_schema.sql` — current `proposals` RLS policy (`auth.uid() = user_id`) that must be extended to a dual-policy
- `supabase/migrations/00001_foundation_schema.sql` — `profiles` table structure (Stripe fields are present but seat sync is deferred)

### Auth and Billing Patterns to Follow
- `src/lib/billing/subscription-check.ts` — `checkSubscription()` / `isSubscriptionActive()` pattern; `requireProposalRole()` should follow the same pattern (async, returns typed result)
- `src/lib/supabase/server.ts` — `createServerClient` pattern used in all server-side auth checks
- `src/app/(dashboard)/layout.tsx` — dashboard auth guard pattern (getUser + redirect)
- `src/app/api/webhooks/stripe/route.ts` — webhook handler pattern (for reference if seat sync is added later)

### Stack Conventions (AGENTS.md)
- `AGENTS.md` — Next.js 16 breaking changes: `proxy.ts`, awaited `cookies()`/`params`, `@supabase/ssr` only
- `src/proxy.ts` — route protection lives here (re-exported as middleware)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts` (`createServerClient`) — use in all new server components and API routes
- `src/lib/supabase/admin.ts` (`createAdminClient`) — use in the invite webhook/callback route where `inviteUserByEmail` needs service role
- `src/lib/billing/subscription-check.ts` — template for `requireProposalRole()` (same async pattern, typed return)
- `src/app/(dashboard)/layout.tsx` — auth guard pattern to replicate in proposal-level role checks

### Established Patterns
- RLS policy form: `(select auth.uid()) = user_id` (cached form — already used in all existing policies; new team policies must follow same cached form)
- Server Actions and route handlers: `getUser()` → check result → proceed or return 401
- Stripe webhook: `createAdminClient()` + `.from('profiles').update(...)` — same pattern for any seat count update

### Integration Points
- `src/app/(dashboard)/proposals/[id]/page.tsx` — proposal detail page where the "Share" button will be added
- `supabase/migrations/` — new migration file needed for `teams`, `team_members`, `team_invites` tables + dual RLS on proposals
- `src/app/api/` — new routes needed: `teams/create`, `teams/invite`, `teams/accept`, `teams/decline`, `teams/members/[id]` (role change + remove)

</code_context>

<deferred>
## Deferred Ideas

- **Stripe per-seat billing** — Track seats in DB in v2; increment/decrement Stripe subscription quantity in v3
- **Account-level team management page** — Dedicated settings page for team management; Phase 7 covers this inline on the proposal page only
- **Team-level proposal creation** — Creating a new proposal that is automatically team-owned from the start; Phase 7 only covers sharing existing proposals via the Share button

</deferred>

---

*Phase: 07-team-accounts-rbac*
*Context gathered: 2026-03-25*
