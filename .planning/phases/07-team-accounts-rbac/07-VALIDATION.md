---
phase: 7
slug: team-accounts-rbac
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/teams/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (full suite ~800ms based on prior phases) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/teams/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | TEAM-01 | migration | `npx vitest run tests/teams/schema.test.ts` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 0 | TEAM-06 | rls | `npx vitest run tests/teams/rls.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | TEAM-01,02 | unit | `npx vitest run tests/teams/team-create.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | TEAM-03 | unit | `npx vitest run tests/teams/invite.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-03 | 02 | 1 | TEAM-04,05 | unit | `npx vitest run tests/teams/member-mgmt.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 1 | TEAM-06 | unit | `npx vitest run tests/teams/proposal-role.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 1 | TEAM-06 | unit | `npx vitest run tests/teams/proposal-role.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 2 | TEAM-02,03 | manual | — | n/a | ⬜ pending |
| 7-04-02 | 04 | 2 | TEAM-03 | manual | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/teams/schema.test.ts` — migration structure tests for `teams`, `team_members`, `team_invites` tables + `proposals.team_id` FK + `get_team_ids_for_user()` function (TEAM-01)
- [ ] `tests/teams/rls.test.ts` — dual RLS policy tests: solo user can only see own proposals, team member can see team proposals, non-member cannot (TEAM-06)
- [ ] `tests/teams/team-create.test.ts` — stubs for team creation API route (TEAM-01, TEAM-02)
- [ ] `tests/teams/invite.test.ts` — stubs for invite route: new-user path + existing-user error handling (TEAM-02, TEAM-03)
- [ ] `tests/teams/member-mgmt.test.ts` — stubs for role change + remove member routes (TEAM-04, TEAM-05)
- [ ] `tests/teams/proposal-role.test.ts` — `requireProposalRole()` unit tests: owner/editor/viewer access + non-member 403 (TEAM-06)

*All test files created as stubs in Wave 0 before any implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Invited user receives email and can click accept | TEAM-03 | Supabase `inviteUserByEmail` triggers external SMTP — cannot assert email delivery in Vitest | Send invite in dev → check Supabase email logs → click accept link → verify redirected to proposal |
| Invited user can decline invite | TEAM-03 | Requires browser interaction with accept/decline UI | Invite a test user → click decline route → verify invite marked declined in DB |
| Share modal opens and submits invite form | TEAM-02 | UI interaction on proposal page | Open proposal → click Share → fill email + role → submit → verify `team_invites` row in DB |
| Viewer cannot edit proposal via UI | TEAM-06 | Role-based UI rendering | Log in as viewer-role member → open proposal → verify editor toolbar is read-only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
