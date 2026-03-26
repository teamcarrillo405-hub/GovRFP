---
phase: 07-team-accounts-rbac
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rbac, teams, sql, migration]

# Dependency graph
requires:
  - phase: 06-export-pipeline
    provides: proposal_sections table and existing RLS patterns to extend

provides:
  - teams table with owner_id, name, seat_count, timestamps + RLS
  - team_members table with role (owner/editor/viewer), unique constraint + RLS
  - team_invites table with status (pending/accepted/declined) + invitee SELECT policy
  - get_team_ids_for_user() SECURITY DEFINER function (prevents RLS recursion)
  - proposals.team_id nullable FK with dual RLS (solo owner + team member policies)
  - proposal_sections dual RLS via team membership
  - 6 Wave 0 test stub files covering all Phase 7 test scenarios

affects:
  - 07-02 (team creation API — depends on teams + team_members tables)
  - 07-03 (invite flow — depends on team_invites table + invitee RLS)
  - 07-04 (member management — depends on team_members + seat_count)
  - 07-05 (requireProposalRole utility — depends on proposals.team_id + team_members RLS)
  - 08-presence (Supabase Realtime — depends on team membership context)
  - 10-comments (section comments — depends on proposal_sections team RLS)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER helper function pattern for RLS recursion prevention"
    - "Dual RLS policy pattern: solo user_id policy + team membership policy on same table"
    - "Correct migration ordering: table first, then SECURITY DEFINER function, then policies referencing function"

key-files:
  created:
    - supabase/migrations/00005_team_accounts.sql
    - tests/teams/schema.test.ts
    - tests/teams/rls.test.ts
    - tests/teams/team-create.test.ts
    - tests/teams/invite.test.ts
    - tests/teams/member-mgmt.test.ts
    - tests/teams/proposal-role.test.ts
  modified: []

key-decisions:
  - "D-03: SECURITY DEFINER function get_team_ids_for_user() must come after team_members table but before any RLS policies that call it — migration ordering enforces this"
  - "D-04: proposals.team_id is nullable with on delete set null — proposals are never orphaned when a team is deleted"
  - "Invitee SELECT policy uses (select email from auth.users where id = (select auth.uid())) to allow invitees to see their pending invites without public email exposure"

patterns-established:
  - "Dual RLS: each user-owned table now has two policies — solo (auth.uid() = user_id) and team (team_id in get_team_ids_for_user()) — both must be added to any table that can be team-owned"
  - "SECURITY DEFINER isolation: all team membership checks go through get_team_ids_for_user() to prevent infinite recursion in RLS evaluation"
  - "Wave 0 stubs: all 6 test files created before implementation begins, matching Nyquist compliance requirements"

requirements-completed: [TEAM-01, TEAM-06, TEAM-07]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 7 Plan 01: Team Accounts — DB Foundation + Wave 0 Test Stubs

**Supabase migration creating teams/team_members/team_invites tables with dual RLS on proposals and proposal_sections, SECURITY DEFINER recursion guard, and 6 Wave 0 test stub files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T17:54:53Z
- **Completed:** 2026-03-25T17:57:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `00005_team_accounts.sql` with correct ordering: teams table → team_members table → get_team_ids_for_user() SECURITY DEFINER function → RLS policies → team_invites → proposals.team_id dual RLS → proposal_sections dual RLS → indexes
- Dual RLS established on both proposals and proposal_sections: existing solo owner policies unchanged, team member policies added alongside them
- All 6 Wave 0 test stub files created in `tests/teams/` — schema.test.ts has 6 passing executable tests against the migration SQL; remaining 5 files have 29 `it.todo()` stubs ready for Plans 02-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test stubs** - `040174c` (test)
2. **Task 2: 00005_team_accounts.sql migration** - `d21114c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `supabase/migrations/00005_team_accounts.sql` — Full team accounts migration: 3 new tables, SECURITY DEFINER function, dual RLS on proposals and proposal_sections, invitee SELECT policy, 5 performance indexes
- `tests/teams/schema.test.ts` — 6 passing migration structure tests using fs.readFileSync + regex assertions
- `tests/teams/rls.test.ts` — 5 dual RLS policy stubs (it.todo)
- `tests/teams/team-create.test.ts` — 4 team creation endpoint stubs (it.todo)
- `tests/teams/invite.test.ts` — 8 invite flow stubs (it.todo)
- `tests/teams/member-mgmt.test.ts` — 5 member management stubs (it.todo)
- `tests/teams/proposal-role.test.ts` — 6 requireProposalRole() stubs (it.todo)

## Decisions Made

- Migration ordering confirmed: `team_members` table must precede `get_team_ids_for_user()` function because the function body references `team_members`. Postgres `CREATE OR REPLACE FUNCTION` would succeed even if the table didn't exist (deferred binding), but creating the table first is correct and safe.
- Dual RLS does not require modifying existing solo policies — both policies coexist on the same table and Postgres evaluates them with OR semantics (any passing policy grants access)
- `invitee_email = (select email from auth.users where id = (select auth.uid()))` pattern chosen for the invitee SELECT policy to avoid joining auth.users in the calling query

## Deviations from Plan

None — plan executed exactly as written. The migration ordering note in the plan (warning about forward reference, then providing the corrected ordering) was followed precisely.

## Issues Encountered

None. The `schema.test.ts` file reads the migration with `fs.readFileSync` and all 6 assertions passed immediately after migration creation.

## User Setup Required

None — migration file only. The migration must be applied to the Supabase database via `supabase db push` or the dashboard SQL editor before Phase 7 API routes go live.

## Known Stubs

- `tests/teams/rls.test.ts`: 5 RLS behavioral tests marked `it.todo()` — will be implemented in Plan 02 or 03 as structural assertions against migration SQL
- `tests/teams/team-create.test.ts`: 4 API route tests — implemented in Plan 02
- `tests/teams/invite.test.ts`: 8 invite flow tests — implemented in Plan 03
- `tests/teams/member-mgmt.test.ts`: 5 member management tests — implemented in Plan 04
- `tests/teams/proposal-role.test.ts`: 6 utility tests — implemented in Plan 05

These stubs are intentional Wave 0 scaffolding per Nyquist compliance. They do not prevent Plan 01's goal (migration + test structure) from being achieved.

## Next Phase Readiness

- Phase 7, Plan 02 (team creation API route) can start immediately — `teams` and `team_members` tables are defined
- Phase 7, Plan 03 (invite flow) can start after Plan 02 — `team_invites` table is defined
- All later phases (08 presence, 10 comments) that need team context have `team_members` and `get_team_ids_for_user()` available

---
*Phase: 07-team-accounts-rbac*
*Completed: 2026-03-25*
