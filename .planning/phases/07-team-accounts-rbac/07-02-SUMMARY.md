---
phase: 07
plan: 02
subsystem: team-accounts-rbac
tags: [api-routes, rbac, auth, teams, invite-flow, role-enforcement]
dependency_graph:
  requires: [07-01]
  provides: [requireProposalRole, team-api-routes, invite-flow, member-management]
  affects: [07-03, 07-04, all-subsequent-mutating-routes]
tech_stack:
  added: []
  patterns: [admin-client-for-rbac-writes, structural-source-tests, role-order-numeric-comparison]
key_files:
  created:
    - src/lib/auth/proposal-role.ts
    - src/app/api/teams/route.ts
    - src/app/api/teams/invite/route.ts
    - src/app/api/teams/invite/accept/route.ts
    - src/app/api/teams/invite/decline/route.ts
    - src/app/api/teams/members/[id]/route.ts
  modified:
    - src/proxy.ts
    - tests/teams/proposal-role.test.ts
    - tests/teams/team-create.test.ts
    - tests/teams/invite.test.ts
    - tests/teams/member-mgmt.test.ts
    - tests/teams/rls.test.ts
decisions:
  - "Admin client used for all team writes to bypass RLS race condition (team row + member row must both exist before user's RLS can evaluate)"
  - "decline endpoint has no auth guard — invited user may not have an account yet"
  - "seat_count derived from COUNT(*) on team_members after each change, not incremented in-place (race-safe)"
  - "proxy.ts adds /api/teams to isProtected but NOT /invite/* (email link arrives unauthenticated)"
  - "Zod v4 error access via parsed.error.issues throughout (not .errors)"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created: 6
  files_modified: 6
---

# Phase 7 Plan 02: Team API Routes + requireProposalRole() Summary

**One-liner:** Server-side team CRUD, invite flow, member management, and role-enforcement utility using admin client for RLS-safe writes with race-safe seat_count derived from actual member count.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | requireProposalRole() utility + TDD tests | 419b3db | src/lib/auth/proposal-role.ts, tests/teams/proposal-role.test.ts |
| 2 | Team API routes + proxy.ts + all test stubs | 5d44e75 | 5 route files, src/proxy.ts, 4 test files |

## What Was Built

### requireProposalRole() Utility

`src/lib/auth/proposal-role.ts` — canonical role enforcement utility used by all subsequent mutating routes.

- `ProposalRole` type: `'owner' | 'editor' | 'viewer' | 'none'`
- `ProposalRoleResult`: `{ role, hasAccess, isOwner, canEdit }`
- `ROLE_ORDER` numeric map: owner=3, editor=2, viewer=1, none=0
- Two-path lookup: solo owner (proposal.user_id) + team membership (team_members + teams.owner_id)
- `minRole` enforcement via numeric comparison
- Imports only from `@/lib/supabase/server`, uses `getUser()` not `getSession()`

### API Routes

**POST /api/teams** — Creates team, inserts owner as member (role='owner'), links proposal to team. Returns 201. Uses admin client to avoid RLS race condition.

**POST /api/teams/invite** — Owner-only invite with Zod validation. Inserts team_invites record, calls `inviteUserByEmail`, handles "already registered" error gracefully with `existing_user: true` flag.

**POST /api/teams/invite/accept** — Authenticated accept flow: validates pending invite, inserts team_member, marks invite accepted, recalculates seat_count from COUNT(*).

**POST /api/teams/invite/decline** — No-auth endpoint (user arrives from email link without account). Marks invite declined.

**PATCH /api/teams/members/[id]** — Owner-only role change to editor or viewer (cannot PATCH to owner). Awaits params per Next.js 16.

**DELETE /api/teams/members/[id]** — Owner-only member removal. Recalculates seat_count from actual member count after deletion.

### proxy.ts Update

Added `/api/teams` to `isProtected` check. Does NOT add `/invite` to protected list — decline route requires unauthenticated access from email links.

## Test Results

- 51 tests passing across 6 test files (teams suite)
- 231 unit tests total passing (no regressions)
- 8 pre-existing E2E Playwright spec failures (unrelated — picked up by Vitest erroneously, pre-existing before this plan)
- No `it.todo` calls remaining in any teams test file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion used string literal instead of variable name**
- **Found during:** Task 2 — first test run
- **Issue:** `invite.test.ts` checked for `'existing_user: true'` as a literal string, but the route uses `existing_user: existingUser` (variable)
- **Fix:** Updated test to check `'existingUser = true'` (assignment) and `'existing_user'` (field presence)
- **Files modified:** tests/teams/invite.test.ts
- **Commit:** Included in 5d44e75

## Known Stubs

None — all route logic is fully implemented. No hardcoded empty arrays, placeholder text, or unwired data sources.

## Self-Check: PASSED

Files confirmed to exist:
- src/lib/auth/proposal-role.ts — FOUND
- src/app/api/teams/route.ts — FOUND
- src/app/api/teams/invite/route.ts — FOUND
- src/app/api/teams/invite/accept/route.ts — FOUND
- src/app/api/teams/invite/decline/route.ts — FOUND
- src/app/api/teams/members/[id]/route.ts — FOUND

Commits confirmed:
- 419b3db: feat(07-02): implement requireProposalRole() utility
- 5d44e75: feat(07-02): build team API routes, update proxy.ts, implement all test stubs
