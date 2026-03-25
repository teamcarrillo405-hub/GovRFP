# Phase 7: Team Accounts + RBAC - Research

**Researched:** 2026-03-25
**Domain:** Supabase RLS multi-policy, inviteUserByEmail, server-side RBAC, Next.js 16 SSR patterns
**Confidence:** HIGH (core patterns verified against official docs and codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add nullable `team_id` FK to `proposals` table — a proposal belongs to one team (or remains solo)
- **D-02:** RLS on `proposals` becomes dual-policy: `auth.uid() = user_id` (solo) OR user is a member of `team_id` (team access)
- **D-03:** The RLS dual-policy migration is the **first artifact** of Phase 7 — all other work depends on it
- **D-04:** Existing solo proposals are unaffected — `team_id` is nullable, no data migration needed
- **D-05:** Sharing starts from a **"Share" button on the proposal page** — proposal-first flow
- **D-06:** Clicking "Share" opens a modal/panel where the owner creates a team (if none exists) and invites teammates by email + role in one step
- **D-07:** No separate account-level "Team settings" page in Phase 7 — team management accessible from the proposal share panel only
- **D-08:** Use `supabase.auth.admin.inviteUserByEmail(email, { data: { team_id, role, invite_id } })` — zero-config, no new email service required
- **D-09:** On accept: invited user lands in the app, invite record is marked accepted, proposal becomes visible in their dashboard
- **D-10:** On decline: user clicks a decline link (custom route) that marks the invite as declined and removes any pending DB record
- **D-11:** Track seat count in the DB only — no Stripe subscription quantity changes in v2
- **D-12:** TEAM-07 is fulfilled by recording seat counts in DB — Stripe per-seat billing deferred to v3
- **D-13:** Team members do not need their own Stripe subscription — they access proposals through the owner's team
- **D-14:** Build `requireProposalRole(proposalId, minRole)` server utility in `src/lib/auth/proposal-role.ts`
- **D-15:** Roles: `owner` (full control) > `editor` (can edit proposal content) > `viewer` (read-only)
- **D-16:** Server-side enforcement is canonical — viewer calling a mutating route directly receives 403

### Claude's Discretion
- Exact SQL schema for `teams`, `team_members`, `team_invites` tables
- Invite token structure and expiry (Supabase handles this via `inviteUserByEmail`)
- Exact modal/panel component design for the Share flow
- How `requireProposalRole()` reads team membership (direct query vs. helper)

### Deferred Ideas (OUT OF SCOPE)
- Stripe per-seat billing — Track seats in DB in v2; Stripe quantity sync in v3
- Account-level team management page — Phase 7 only covers inline on proposal page
- Team-level proposal creation — Phase 7 only covers sharing existing proposals via Share button
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEAM-01 | User can create a team and become the team owner | `teams` table + create API route + RLS owner policy |
| TEAM-02 | Owner can invite teammates by email with an assigned role (editor / viewer) | `inviteUserByEmail` admin API + `team_invites` table + invite API route |
| TEAM-03 | Invited user receives an email and can accept or decline the invite | Supabase built-in invite email + `/invite/accept` route + `/api/teams/invite/decline` route |
| TEAM-04 | Owner can change a team member's role after joining | PATCH `/api/teams/members/[id]` + `requireProposalRole` owner check |
| TEAM-05 | Owner can remove a team member from the team | DELETE `/api/teams/members/[id]` + seat_count decrement |
| TEAM-06 | Team members can view and edit proposals shared with their team (scoped by role) | Dual RLS policy on `proposals` + `proposal_sections` + `requireProposalRole` in mutating routes |
| TEAM-07 | Stripe seat count increments on invite acceptance and decrements on member removal | `seat_count` column on `teams` table, updated in accept/remove routes (DB-only in v2) |
</phase_requirements>

---

## Summary

Phase 7 adds multi-user access to a currently solo-user app. The core technical work is: (1) a new Supabase migration adding three tables (`teams`, `team_members`, `team_invites`) plus a nullable `team_id` FK on `proposals`, (2) extending existing single-policy RLS to dual-policy on `proposals` and `proposal_sections`, (3) implementing the `inviteUserByEmail` invite flow with an `/invite/accept` route handler, and (4) building the `requireProposalRole()` server utility that every mutating API route calls.

The biggest technical risks are RLS recursion on the `team_members` table (prevented by a `SECURITY DEFINER` helper function) and the `inviteUserByEmail` limitation that it only works for users who do not yet exist in `auth.users`. For existing users invited to join a team, a separate code path is required: create the `team_invites` DB record, send a custom email (or use Supabase magic link), and accept by token lookup rather than invite verification.

The existing codebase patterns (cached `(select auth.uid())` RLS form, `createAdminClient()` for service-role ops, `subscription-check.ts` as template for `requireProposalRole`, `params` awaiting in Next.js 16) are all well-established and must be followed exactly.

**Primary recommendation:** Build migration first, then invite flow, then role-enforcement utility, then UI — exactly per the locked decision D-03 sequencing. Never use `getSession()`, never use the deprecated `@supabase/auth-helpers-nextjs`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.9.0 (installed) | Server-side Supabase client | Already in project; required for Next.js 16 cookie-based auth |
| `@supabase/supabase-js` | 2.100.0 (installed) | Admin client (`createAdminClient`) for invite calls | Already in project; service-role ops in webhook/API routes |
| Next.js | 16.2.1 (installed) | Route handlers for invite accept/decline/member CRUD | Already in project |
| Zod | 4.3.6 (installed) | Request body validation in new API routes | Already in project; use `parsed.error.issues` not `.errors` |

### No New Dependencies Required
All libraries needed for Phase 7 are already installed. This is a pure schema + server logic phase.

### Version verification
```bash
# All verified from package.json + node_modules:
# @supabase/ssr: 0.9.0
# @supabase/supabase-js: 2.100.0
# next: 16.2.1
# zod: 4.3.6
```

---

## Architecture Patterns

### Recommended New File Structure
```
src/
  lib/
    auth/
      proposal-role.ts          # requireProposalRole(proposalId, minRole) utility
  app/
    (dashboard)/
      proposals/
        [id]/
          page.tsx              # Add Share button + SharePanel component
    invite/
      accept/
        page.tsx                # Client component — reads token from URL hash, calls /api/teams/invite/accept
      decline/
        page.tsx                # Client component — reads token param, calls decline API
    api/
      teams/
        route.ts                # POST: create team (TEAM-01)
        invite/
          route.ts              # POST: send invite (TEAM-02)
          accept/
            route.ts            # POST: mark invite accepted, add team_member (TEAM-03)
          decline/
            route.ts            # POST: mark invite declined (TEAM-03)
        members/
          [id]/
            route.ts            # PATCH: change role (TEAM-04); DELETE: remove member (TEAM-05)
  components/
    teams/
      SharePanel.tsx            # Modal/panel — create team + invite form
      MemberList.tsx            # List members with role/remove controls
supabase/
  migrations/
    00005_team_accounts.sql     # teams, team_members, team_invites, proposals.team_id, dual RLS
```

### Pattern 1: Dual RLS Policy on proposals (AND proposal_sections)

Supabase RLS uses OR logic across multiple policies — if any policy allows, access is granted. The existing solo policy stays unchanged; a new team-membership policy is added.

**Critical:** The `team_members` lookup inside the new policy MUST use a `SECURITY DEFINER` function to prevent infinite recursion when `team_members` has its own RLS.

```sql
-- Source: Supabase RLS docs + discussion #4509
-- Helper function — bypasses RLS on team_members (prevents recursion)
create or replace function public.get_team_ids_for_user(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from team_members where user_id = p_user_id
$$;

-- New team-access policy on proposals (solo policy stays, OR logic applies)
create policy "Team members can access team proposals"
  on proposals for all to authenticated
  using (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  )
  with check (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  );
```

**Why with check matches using:** A team member should only be able to write to proposals already belonging to their team. Role enforcement (owner vs editor vs viewer) is handled in `requireProposalRole()`, not at RLS level — RLS gates team membership, the utility gates the role.

The same dual-policy pattern applies to `proposal_sections` — add a team-access policy there too.

### Pattern 2: team_members RLS — No Recursion via SECURITY DEFINER

The `team_members` table needs its own RLS so users can only read memberships for their own teams. The naive approach (subquery inside the policy) causes recursion.

```sql
-- Source: Supabase discussion #4509 (verified working pattern)
-- Policy uses the SECURITY DEFINER function defined above

create policy "Users can view members of their teams"
  on team_members for select to authenticated
  using (
    team_id in (select get_team_ids_for_user((select auth.uid())))
  );

create policy "Users can view own membership"
  on team_members for select to authenticated
  using (
    (select auth.uid()) = user_id
  );
```

Two SELECT policies on `team_members` — a user can see their own row, OR all rows of teams they belong to.

### Pattern 3: inviteUserByEmail — API Call and Accept Flow

**Source: Supabase JS reference + GitHub discussion #6055 + #21097**

```typescript
// In: src/app/api/teams/invite/route.ts
// Requires: createAdminClient() — service role only
import { createAdminClient } from '@/lib/supabase/admin'

const adminSupabase = createAdminClient()

// Step 1: Insert pending record BEFORE calling invite
// (this gives us invite_id to embed in metadata)
const { data: invite } = await adminSupabase
  .from('team_invites')
  .insert({ team_id, invitee_email, role, status: 'pending', invited_by: userId })
  .select('id')
  .single()

// Step 2: Send the invite email
const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/accept`,
  data: {
    team_id,
    role,
    invite_id: invite.id,
  },
})
```

**What inviteUserByEmail does:**
- Creates a new `auth.users` record (if email does not exist) with `email_confirmed_at = null` and the `data` object stored in `user_metadata`
- Sends a Supabase-managed invite email using the "Invite" template
- The email link uses `{{ .ConfirmationURL }}` which routes through Supabase auth servers, then redirects to `redirectTo`
- After redirect, the URL contains `access_token` and `refresh_token` as hash fragments (`#access_token=...`)

**Critical limitation — existing users:**
If the email already has an `auth.users` account, `inviteUserByEmail` returns an error. This means Phase 7 must handle two cases:
1. New user: `inviteUserByEmail` works as described
2. Existing user: Skip `inviteUserByEmail`, just insert the `team_invites` record. Send a custom notification email (or rely on the proposal appearing in their dashboard after owner sends invite). The accept flow for existing users hits `/api/teams/invite/accept` directly via a link in a custom email, or the owner can notify them out-of-band.

**Design recommendation (Claude's discretion):** For v2, when `inviteUserByEmail` fails with "user already registered", fall back to inserting the invite record and showing the owner a message: "This user already has an account — they will see this proposal once they log in." This avoids building a custom email pipeline. The `team_invites` record with status `pending` allows the existing user to accept from a notification banner on their dashboard.

### Pattern 4: Accept Route — /invite/accept

The accept flow is a two-part process:
1. Supabase's auth servers verify the token and redirect to `redirectTo` with session tokens in URL hash
2. Our app route reads the session, calls the accept API

```typescript
// src/app/invite/accept/page.tsx — 'use client'
// Supabase processes the invite link server-side, then redirects here with tokens in hash

'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AcceptInvitePage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  useEffect(() => {
    // Supabase JS automatically reads #access_token from hash and sets session
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Read invite metadata from user_metadata
        const inviteId = session.user.user_metadata?.invite_id
        const teamId = session.user.user_metadata?.team_id
        if (inviteId && teamId) {
          await fetch('/api/teams/invite/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_id: inviteId, team_id: teamId }),
          })
        }
        router.push('/dashboard')
      }
    })
  }, [])

  return <p>Accepting invite...</p>
}
```

```typescript
// src/app/api/teams/invite/accept/route.ts
// Server-side: mark invite accepted, insert team_member, increment seat_count
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invite_id, team_id } = await request.json()

  // Use admin client to bypass RLS on team_invites (pending invite may belong to different user row)
  const adminSupabase = createAdminClient()

  const { data: invite } = await adminSupabase
    .from('team_invites')
    .select('*')
    .eq('id', invite_id)
    .eq('team_id', team_id)
    .eq('status', 'pending')
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 400 })

  // Atomic: insert member + mark accepted + increment seat_count
  await adminSupabase.from('team_members').insert({
    team_id,
    user_id: user.id,
    role: invite.role,
  })
  await adminSupabase
    .from('team_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite_id)
  await adminSupabase
    .from('teams')
    .update({ seat_count: adminSupabase.rpc('increment_seat_count', { p_team_id: team_id }) })
    // Simpler: use a raw increment

  return NextResponse.json({ ok: true })
}
```

**Note on seat_count increment:** Use a Postgres function or `seat_count = seat_count + 1` pattern via RPC to avoid race conditions. Alternatively: derive seat_count as `select count(*) from team_members where team_id = $1` at read time (no increment needed).

### Pattern 5: requireProposalRole() Utility

Follows the exact pattern of `subscription-check.ts`. Returns typed result; caller decides how to respond.

```typescript
// src/lib/auth/proposal-role.ts
// Source: mirrors src/lib/billing/subscription-check.ts pattern
import { createClient } from '@/lib/supabase/server'

export type ProposalRole = 'owner' | 'editor' | 'viewer' | 'none'

export interface ProposalRoleResult {
  role: ProposalRole
  hasAccess: boolean
  isOwner: boolean
  canEdit: boolean
}

const ROLE_ORDER: Record<ProposalRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
  none: 0,
}

export async function requireProposalRole(
  proposalId: string,
  minRole: ProposalRole
): Promise<ProposalRoleResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if user is solo owner (user_id = auth.uid())
  const { data: proposal } = await supabase
    .from('proposals')
    .select('user_id, team_id')
    .eq('id', proposalId)
    .single()

  if (!proposal) return null

  let role: ProposalRole = 'none'

  if (proposal.user_id === user.id) {
    role = 'owner'
  } else if (proposal.team_id) {
    // Check team membership
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', proposal.team_id)
      .eq('user_id', user.id)
      .single()

    if (member) {
      // Team creator is owner; member role comes from team_members.role
      const { data: team } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', proposal.team_id)
        .single()
      role = team?.owner_id === user.id ? 'owner' : (member.role as ProposalRole)
    }
  }

  const result: ProposalRoleResult = {
    role,
    hasAccess: ROLE_ORDER[role] >= ROLE_ORDER['viewer'],
    isOwner: role === 'owner',
    canEdit: ROLE_ORDER[role] >= ROLE_ORDER['editor'],
  }

  // Return null means "access denied" — caller returns 401/403
  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) return null

  return result
}
```

**Usage in API routes:**
```typescript
// Any mutating route that touches proposal data
const roleResult = await requireProposalRole(proposalId, 'editor')
if (!roleResult) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Pattern 6: proxy.ts — Protect New Routes

Add new team API routes and invite routes to `isProtected` in `src/proxy.ts`:

```typescript
// src/proxy.ts additions
const isProtected = request.nextUrl.pathname.startsWith('/dashboard') ||
  request.nextUrl.pathname.startsWith('/profile') ||
  request.nextUrl.pathname.startsWith('/account') ||
  request.nextUrl.pathname.startsWith('/api/proposals') ||
  request.nextUrl.pathname.startsWith('/api/generate') ||
  request.nextUrl.pathname.startsWith('/api/billing') ||
  request.nextUrl.pathname.startsWith('/api/teams')   // NEW
  // Note: /invite/accept is NOT protected — user may arrive unauthenticated
```

`/invite/accept` must NOT be in `isProtected` — the user arrives unauthenticated and Supabase's invite link sets the session on that page.

### Anti-Patterns to Avoid

- **Recursion in team_members RLS:** Never query `team_members` directly in a `team_members` RLS policy. Always use a `SECURITY DEFINER` function.
- **getSession() instead of getUser():** All server-side code uses `getUser()` only — CLAUDE.md mandate.
- **Role in JWT claims:** Do not store role in `app_metadata` or JWT — it's proposal-scoped, not user-global. Role lives in `team_members.role`.
- **Client-only role enforcement:** Client UI can reflect role state, but every mutating route must call `requireProposalRole()` — a viewer can call routes directly.
- **inviteUserByEmail without pending DB record:** Always insert `team_invites` row first, then call inviteUserByEmail. This ensures the invite exists even if the email call fails.
- **Hardcoding .eq('user_id', user.id) on proposals:** After team access, proposal pages must NOT hardcode `.eq('user_id', user.id)` — that breaks team members who are not the `user_id`. Remove those explicit eq filters on proposal fetches in existing pages (the dual RLS policy handles access).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Invite email delivery | Custom SMTP + token generation | Supabase `inviteUserByEmail` | Handles token, expiry, template, delivery in zero config |
| Token verification on accept | Custom HMAC validation | Supabase built-in invite link (ConfirmationURL) | Supabase auth servers verify token before redirecting |
| Role hierarchy comparison | Custom enum comparison | `ROLE_ORDER` map + numeric comparison | Simple, testable, extensible |
| RLS policy recursion prevention | Complex policy rewrites | `SECURITY DEFINER` SQL function | Postgres standard pattern, documented by Supabase |
| Seat count atomicity | Application-level locking | Postgres-side count or increment function | Race conditions without DB-level atomicity |

---

## Common Pitfalls

### Pitfall 1: RLS Infinite Recursion on team_members
**What goes wrong:** Writing `team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())` inside a `team_members` SELECT policy causes "infinite recursion detected in policy for relation team_members."
**Why it happens:** The policy references the same table it protects. Every row read triggers the policy, which tries to read rows, which triggers the policy again.
**How to avoid:** Create a `SECURITY DEFINER` function `get_team_ids_for_user(user_id)` that queries `team_members` without RLS. Policies on `team_members` and `proposals` reference this function instead.
**Warning signs:** `42P17: infinite recursion detected in policy for relation "team_members"` in Supabase logs.

### Pitfall 2: inviteUserByEmail Fails for Existing Users
**What goes wrong:** Calling `inviteUserByEmail` for an email that already has an `auth.users` account returns an error. The invite is never created.
**Why it happens:** Supabase Auth does not support re-inviting existing users via this endpoint.
**How to avoid:** Wrap the call in try/catch. If error is "user already registered", treat as successful invite: the `team_invites` DB record is already inserted. Show owner: "This user already has an account — they will see the invite in their dashboard." The existing user will find a pending invite notification when they log in.
**Warning signs:** Non-null `error` from `inviteUserByEmail` with message containing "registered" or "exists."

### Pitfall 3: Breaking Existing Proposal Fetches After Adding team_id
**What goes wrong:** Existing pages like `proposals/[id]/page.tsx` query `proposals` with `.eq('user_id', user.id)`. After team access is added, team members fail to load the proposal (they have a different `user_id`).
**Why it happens:** Explicit `user_id` filters bypass RLS intent. The RLS dual-policy grants team members access, but the application-level `.eq('user_id', ...)` overrides it.
**How to avoid:** Remove `.eq('user_id', user.id)` from all proposal fetch queries in Phase 7. Let RLS enforce access, and use `requireProposalRole()` for authorization context.
**Warning signs:** Team members receive 404 on proposal pages despite valid team membership.

### Pitfall 4: /invite/accept in proxy.ts isProtected
**What goes wrong:** If `/invite/accept` is in `isProtected`, the proxy redirects the user to `/login` before they can complete the invite flow. The invite token in the URL hash is lost.
**Why it happens:** User arrives from email link — they may not have a session cookie yet.
**How to avoid:** Do NOT add `/invite/accept` or `/invite/*` to `isProtected` in `proxy.ts`. Authentication is established by Supabase on the accept page itself.
**Warning signs:** New users invited via email are immediately bounced to `/login`.

### Pitfall 5: with check Omitted on team-access Policy
**What goes wrong:** Without a `with check` clause on the new team proposals policy, RLS blocks all INSERT/UPDATE/DELETE for team members even when the USING clause would allow SELECT.
**Why it happens:** In Postgres, `with check` is required for write operations; if absent, INSERT/UPDATE use the USING expression, but this can behave unexpectedly.
**How to avoid:** Always pair `using` with an identical `with check` clause on the team-access policy. The editor role restriction is enforced at the application layer by `requireProposalRole()`, not at RLS.
**Warning signs:** Editors receive 403 on write operations despite passing role checks.

### Pitfall 6: seat_count Race Condition
**What goes wrong:** If two invites are accepted simultaneously, both read `seat_count = 2`, both write `seat_count = 3`, and one increment is lost.
**Why it happens:** Non-atomic read-modify-write at application layer.
**How to avoid:** Use Postgres-side increment: `UPDATE teams SET seat_count = seat_count + 1 WHERE id = $1`. Alternatively, derive `seat_count` at read time from `COUNT(*)` on `team_members` and store no counter at all — simpler and always accurate.

---

## Code Examples

### Full Migration Template (00005_team_accounts.sql)

```sql
-- Source: Supabase RLS docs, discussion #4509, project pattern (00001_foundation_schema.sql)

-- =============================================================================
-- Teams table
-- =============================================================================
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  seat_count  integer not null default 1,  -- owner counts as 1; or derive at read time
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.teams enable row level security;

create policy "Owner can manage their team"
  on teams for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Team members can view their team"
  on teams for select to authenticated
  using (
    id in (select get_team_ids_for_user((select auth.uid())))
  );

-- =============================================================================
-- SECURITY DEFINER helper — prevents recursion in team_members policies
-- =============================================================================
create or replace function public.get_team_ids_for_user(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from team_members where user_id = p_user_id
$$;

-- =============================================================================
-- team_members table
-- =============================================================================
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'viewer'
    check (role in ('owner', 'editor', 'viewer')),
  joined_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.team_members enable row level security;

-- Uses helper function — no recursion
create policy "Team members can view own team roster"
  on team_members for select to authenticated
  using (
    team_id in (select get_team_ids_for_user((select auth.uid())))
  );

create policy "Owner can manage team membership"
  on team_members for all to authenticated
  using (
    team_id in (
      select id from teams where owner_id = (select auth.uid())
    )
  )
  with check (
    team_id in (
      select id from teams where owner_id = (select auth.uid())
    )
  );

-- =============================================================================
-- team_invites table
-- =============================================================================
create table public.team_invites (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams on delete cascade,
  invited_by      uuid not null references auth.users on delete cascade,
  invitee_email   text not null,
  role            text not null default 'viewer'
    check (role in ('editor', 'viewer')),
  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (team_id, invitee_email)
);

alter table public.team_invites enable row level security;

create policy "Owner can manage team invites"
  on team_invites for all to authenticated
  using (
    team_id in (
      select id from teams where owner_id = (select auth.uid())
    )
  )
  with check (
    team_id in (
      select id from teams where owner_id = (select auth.uid())
    )
  );

-- =============================================================================
-- proposals: add team_id FK (nullable — solo proposals unaffected)
-- =============================================================================
alter table public.proposals
  add column team_id uuid references public.teams on delete set null;

create index on proposals (team_id);

-- New team-access policy (solo policy stays — OR logic, either grants access)
create policy "Team members can access team proposals"
  on proposals for all to authenticated
  using (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  )
  with check (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  );

-- =============================================================================
-- proposal_sections: add team-access policy
-- =============================================================================
create policy "Team members can access team proposal_sections"
  on proposal_sections for all to authenticated
  using (
    proposal_id in (
      select id from proposals
      where team_id is not null
        and team_id in (select get_team_ids_for_user((select auth.uid())))
    )
  )
  with check (
    proposal_id in (
      select id from proposals
      where team_id is not null
        and team_id in (select get_team_ids_for_user((select auth.uid())))
    )
  );

-- =============================================================================
-- Performance indexes
-- =============================================================================
create index on team_members (user_id);
create index on team_members (team_id);
create index on team_invites (team_id);
create index on team_invites (invitee_email);
```

### createAdminClient() Usage in Invite Route

```typescript
// Source: mirrors src/app/api/webhooks/stripe/route.ts pattern
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const user = await getUser()  // validates JWT
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()  // service role — bypasses RLS
  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/accept`,
    data: { team_id, role, invite_id },
  })
  // ...
}
```

---

## Migration Sequencing

**This is the mandatory build order — each step depends on the previous.**

| Step | Artifact | Reason |
|------|----------|--------|
| 1 | `00005_team_accounts.sql` | All tables, `SECURITY DEFINER` function, dual RLS on proposals and proposal_sections |
| 2 | `src/lib/auth/proposal-role.ts` | `requireProposalRole()` — needed by all new API routes |
| 3 | `POST /api/teams` | Create team — needed before invites |
| 4 | `POST /api/teams/invite` | Send invite — needs team to exist |
| 5 | `POST /api/teams/invite/accept` + `/invite/accept` page | Accept flow |
| 6 | `POST /api/teams/invite/decline` + `/invite/decline` page | Decline flow |
| 7 | `PATCH/DELETE /api/teams/members/[id]` | Role change + member removal |
| 8 | `SharePanel` + `MemberList` UI components | All API routes must exist first |
| 9 | Wire Share button into `proposals/[id]/page.tsx` | Final integration |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid() = user_id` only | Dual-policy: solo OR team | Phase 7 (this phase) | Existing solo proposals unaffected |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | ~2023 | Must never use old package |
| `middleware.ts` directly | `proxy.ts` re-exported as middleware | Next.js 16 | Route protection lives in proxy.ts |
| `getSession()` server-side | `getUser()` server-side | Current best practice | getSession does not revalidate JWT |

---

## Open Questions

1. **Existing-user invite fallback notification mechanism**
   - What we know: `inviteUserByEmail` fails for registered emails. DB invite record still inserted.
   - What's unclear: How does the existing user discover the pending invite? Options: (a) dashboard banner checking `team_invites` for their email, (b) owner is told to notify them, (c) Phase 7 uses option (b) as simplest.
   - Recommendation: Implement dashboard notification (query `team_invites` by invitee_email = current user email). This is a small addition to the dashboard page.

2. **proposal_sections `user_id` column after team access**
   - What we know: `proposal_sections` has a `user_id` column that ties to the creator. After team sharing, editors need to write sections too.
   - What's unclear: Should team editors' writes use their own `user_id` on `proposal_sections`, or the owner's?
   - Recommendation: Each member writes with their own `user_id`. The new team-access RLS policy allows any team member to insert/update rows for the proposal. The `user_id` on `proposal_sections` becomes an "authored by" field, not an ownership gate.

3. **seat_count: stored column vs. derived count**
   - What we know: D-12 says DB-only tracking. A stored `seat_count` column has race conditions; a derived `COUNT(*)` is always accurate.
   - Recommendation: Remove `seat_count` column from `teams` table and derive it at read time as `SELECT COUNT(*) FROM team_members WHERE team_id = $1`. Simpler and accurate. The v3 Stripe sync can read this count directly.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is purely schema, server logic, and UI changes within the existing stack. No new external services, CLI tools, or runtimes are required. All infrastructure (Supabase, Stripe, Next.js) is already provisioned.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |
| E2E command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEAM-01 | POST /api/teams creates team + owner membership | unit | `npx vitest run tests/teams/team-crud.test.ts -x` | ❌ Wave 0 |
| TEAM-02 | POST /api/teams/invite inserts team_invites + calls inviteUserByEmail | unit | `npx vitest run tests/teams/invite.test.ts -x` | ❌ Wave 0 |
| TEAM-03 | POST /api/teams/invite/accept marks invite accepted + inserts team_member | unit | `npx vitest run tests/teams/invite.test.ts -x` | ❌ Wave 0 |
| TEAM-04 | PATCH /api/teams/members/[id] updates role (owner only) | unit | `npx vitest run tests/teams/member-management.test.ts -x` | ❌ Wave 0 |
| TEAM-05 | DELETE /api/teams/members/[id] removes member (owner only) | unit | `npx vitest run tests/teams/member-management.test.ts -x` | ❌ Wave 0 |
| TEAM-06 | Viewer calling mutating route returns 403 | unit | `npx vitest run tests/teams/rbac-enforcement.test.ts -x` | ❌ Wave 0 |
| TEAM-06 | Team member can read team proposal (RLS) | unit | `npx vitest run tests/rls/team-rls.test.ts -x` | ❌ Wave 0 |
| TEAM-07 | seat_count increments on accept / decrements on remove | unit | `npx vitest run tests/teams/seat-count.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (full existing suite)
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/teams/team-crud.test.ts` — covers TEAM-01
- [ ] `tests/teams/invite.test.ts` — covers TEAM-02, TEAM-03
- [ ] `tests/teams/member-management.test.ts` — covers TEAM-04, TEAM-05
- [ ] `tests/teams/rbac-enforcement.test.ts` — covers TEAM-06 server-side enforcement
- [ ] `tests/teams/seat-count.test.ts` — covers TEAM-07
- [ ] `tests/rls/team-rls.test.ts` — covers TEAM-06 RLS dual-policy

---

## Project Constraints (from CLAUDE.md)

All downstream plans MUST comply:

| Directive | Applies To |
|-----------|-----------|
| Route protection in `src/proxy.ts` only | Add `/api/teams` to `isProtected`; do NOT protect `/invite/*` |
| `cookies()` and `params` must be `await`ed | All new Server Components and Route Handlers |
| `@supabase/ssr` only — never `@supabase/auth-helpers-nextjs` | All new server + client Supabase clients |
| `getUser()` not `getSession()` server-side | All new auth checks including `requireProposalRole()` |
| `createAdminClient()` for service-role ops only — never exposed to browser | invite/accept/decline routes, team mutation routes |
| RLS policy pattern: `(select auth.uid()) = user_id` cached form | All new RLS policies |
| Zod v4: error access via `parsed.error.issues` not `.errors` | Request body validation in new routes |
| Next.js 16: `params` must be awaited in page props | Any new `[id]` route pages |

---

## Sources

### Primary (HIGH confidence)
- Supabase official docs (RLS guide) — dual-policy OR logic, cached `(select auth.uid())` pattern, performance benchmarks
- Supabase official docs (auth-email-templates) — `ConfirmationURL` vs `token_hash`, `type=invite` parameter
- `supabase/migrations/00001_foundation_schema.sql` (project) — exact existing RLS form to extend
- `src/lib/billing/subscription-check.ts` (project) — `requireProposalRole()` template
- `src/lib/supabase/admin.ts` (project) — `createAdminClient()` usage pattern
- `src/proxy.ts` (project) — route protection pattern

### Secondary (MEDIUM confidence)
- GitHub discussion #4509 (`supabase/supabase`) — SECURITY DEFINER function for team_members recursion prevention
- GitHub discussion #6055 (`supabase/supabase`) — `inviteUserByEmail` with metadata, accept flow, existing user limitation
- GitHub discussion #21097 (`supabase/supabase`) — `ConfirmationURL` in invite email template, `redirectTo` usage
- Supabase auth issue #1284 — `verifyOtp` limitation for invite type (use ConfirmationURL redirect instead)

### Tertiary (LOW confidence — flag for validation)
- Existing-user `inviteUserByEmail` error message wording — verify exact error code against live Supabase instance before writing error handling logic
- `seat_count` derived vs. stored decision — verify no performance concern at team sizes expected (< 20 members per team)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions verified from package.json
- Schema design: HIGH — follows documented Supabase RLS patterns, project conventions verified from existing migrations
- inviteUserByEmail flow: MEDIUM — API signature confirmed, accept flow confirmed, existing-user limitation confirmed; exact error codes are LOW confidence (need live verification)
- requireProposalRole() pattern: HIGH — directly mirrors existing subscription-check.ts in the codebase
- RLS recursion prevention: HIGH — SECURITY DEFINER pattern confirmed via official Supabase discussion and RLS docs
- Pitfalls: HIGH — most derived from reading existing codebase (hardcoded user_id filters, proxy.ts isProtected)

**Research date:** 2026-03-25
**Valid until:** 2026-05-01 (Supabase auth APIs are stable; Next.js 16 patterns are locked)
