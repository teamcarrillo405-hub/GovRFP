---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Collaboration + Integrations
status: Ready to execute
stopped_at: Completed 07-02-PLAN.md — team API routes + requireProposalRole()
last_updated: "2026-03-26T01:08:37.860Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Reduce the time from RFP receipt to first compliant proposal draft from days to under 30 minutes
**Current focus:** Phase 07 — team-accounts-rbac

## Current Position

Phase: 07 (team-accounts-rbac) — EXECUTING
Plan: 3 of 5

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v2.0)
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 07-team-accounts-rbac P01 | 3 | 2 tasks | 7 files |
| Phase 07 P02 | 30 | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Roadmap]: Team accounts (Phase 7) is a hard prerequisite for presence (Phase 8) and comments (Phase 10) — RLS dual-policy migration must be the first artifact in Phase 7
- [v2.0 Roadmap]: Presence-only via Supabase Realtime (no Yjs, no Hocuspocus) — full CRDT co-editing deferred to v3
- [v2.0 Roadmap]: GovRFP import + SAM.gov prefill (Phase 9) is independent of team accounts — can be planned/executed in parallel with Phase 8
- [v2.0 Roadmap]: Stripe seat sync on invite acceptance (not invite send) — prevents quantity divergence
- [v2.0 Roadmap]: requireProposalRole() utility built in Phase 7 and reused in all subsequent mutating routes
- [v2.0 Roadmap]: Version snapshots on explicit save + AI regeneration only (not every auto-save) — cap at 50/section
- [Phase 07-team-accounts-rbac]: D-03: SECURITY DEFINER function get_team_ids_for_user() must come after team_members table but before any RLS policies — migration ordering enforces this
- [Phase 07-team-accounts-rbac]: D-04: proposals.team_id is nullable with on delete set null — proposals are never orphaned when a team is deleted
- [Phase 07-team-accounts-rbac]: Dual RLS pattern: solo (auth.uid() = user_id) and team (team_id in get_team_ids_for_user()) policies coexist on same table with OR semantics
- [Phase 07]: Admin client used for all team writes to bypass RLS race condition on team + member row creation
- [Phase 07]: seat_count derived from COUNT(*) not incremented in-place (race-safe for concurrent accepts)
- [Phase 07]: decline endpoint has no auth guard — invited user may lack an account when arriving from email link

### Pending Todos

None.

### Blockers/Concerns

- [Phase 8]: Supabase Realtime Authorization (`private: true` + `realtime.messages` RLS) is Public Beta — verify plan availability before Phase 8 planning begins; fallback is custom JWT verification in Edge Function
- [Phase 9]: SAM.gov `repsAndCerts.certifications` field paths are MEDIUM confidence — validate against live API response before hardcoding field mapping in Phase 9 plan
- [Phase 9]: GovRFP `OpportunityExportPayload` data contract is a proposed interface — must be agreed on with `contractor-rfp-website` maintainer before either side builds the integration

## Session Continuity

Last session: 2026-03-26T01:08:37.856Z
Stopped at: Completed 07-02-PLAN.md — team API routes + requireProposalRole()
Resume file: None
