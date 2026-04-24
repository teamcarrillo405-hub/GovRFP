# Roadmap: HCC ProposalAI

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-03-24)
- ✅ **v1.1 RFP Structure Sidebar** — Phase 6 (shipped 2026-03-25)
- 🚧 **v2.0 Collaboration + Integrations** — Phases 7–11 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Foundation (5/5 plans) — completed 2026-03-23
- [x] Phase 2: Document Ingestion (4/4 plans) — completed 2026-03-23
- [x] Phase 3: RFP Analysis (4/4 plans) — completed 2026-03-23
- [x] Phase 4: Proposal Drafting + Editor (5/5 plans) — completed 2026-03-24
- [x] Phase 5: Export Pipeline (4/4 plans) — completed 2026-03-24

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 RFP Structure Sidebar (Phase 6) — SHIPPED 2026-03-25</summary>

- [x] Phase 6: RFP Structure Sidebar (2/2 plans) — completed 2026-03-25

Full archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v2.0 Collaboration + Integrations (In Progress)

**Milestone Goal:** Expand ProposalAI from solo tool to team-capable platform with cross-product GovRFP integration and operator analytics.

- [ ] **Phase 7: Team Accounts + RBAC** - Multi-user proposals with invite flow, role enforcement, and per-seat billing sync
- [ ] **Phase 8: Real-Time Presence** - Avatar indicators showing who is viewing the same proposal, secured by team membership
- [ ] **Phase 9: GovRFP Import + SAM.gov Prefill** - One-click RFP import from GovRFP and SAM.gov entity data prefill for contractor profiles
- [ ] **Phase 10: Version History + Section Comments** - Snapshot and restore proposal versions; threaded inline comments with team review workflow
- [ ] **Phase 11: Win/Loss Tracking + Operator Dashboard** - Bid outcome logging and HCC admin aggregate metrics dashboard

## Phase Details

### Phase 7: Team Accounts + RBAC
**Goal**: Proposals can be shared with teammates who access and edit them according to their assigned role
**Depends on**: Phase 6 (v1.1 complete)
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06, TEAM-07
**Success Criteria** (what must be TRUE):
  1. User can create a team, invite teammates by email with a role, and the invited user receives an email and can accept or decline
  2. Team members can view and edit the proposal according to their role (owner can edit, viewer cannot)
  3. Owner can change a member's role or remove them from the team after they join
  4. Stripe seat count increments when an invite is accepted and decrements when a member is removed
  5. A viewer-role user cannot mutate proposal data by calling API routes directly (server-side role enforcement)
**Plans:** 1/5 plans executed
Plans:
- [x] 07-01-PLAN.md — Wave 0: Migration + test stubs (teams, team_members, team_invites, dual RLS)
- [ ] 07-02-PLAN.md — Wave 1: API routes + requireProposalRole() utility
- [ ] 07-03-PLAN.md — Wave 2: SharePanel UI + hardcoded user_id fix
- [ ] 07-04-PLAN.md — Wave 2: Invite accept/decline pages + dashboard updates
- [ ] 07-05-PLAN.md — Wave 3: Manual verification checkpoint
**UI hint**: yes

### Phase 8: Real-Time Presence
**Goal**: Team members viewing the same proposal can see who else is present without real-time co-editing infrastructure
**Depends on**: Phase 7
**Requirements**: PRES-01, PRES-02, PRES-03
**Success Criteria** (what must be TRUE):
  1. User sees avatar indicators in the editor header showing which teammates are currently viewing the proposal
  2. Presence indicators update in real time as teammates navigate to or away from the proposal (no page refresh required)
  3. A user who is not a team member of the proposal cannot join or observe the presence channel
**Plans**: TBD
**UI hint**: yes

### Phase 9: GovRFP Import + SAM.gov Prefill
**Goal**: Contractors can pull RFP data from GovRFP and populate their contractor profile from SAM.gov without manual entry
**Depends on**: Phase 6 (independent of team accounts; can run in parallel with Phase 8)
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, SAM-01, SAM-02, SAM-03
**Success Criteria** (what must be TRUE):
  1. User can import an RFP from GovRFP with one click and arrive at a new proposal pre-populated with the RFP title, description, and deadline
  2. The GovRFP import uses a server-to-server signed token — no shared secret is present in any client-side code
  3. User can enter their UEI or CAGE code in their contractor profile and trigger a SAM.gov lookup that prefills certifications and NAICS codes
  4. SAM.gov entity data is cached per contractor for 30 days; a second lookup within 30 days returns the cached result without an API call
**Plans**: TBD
**UI hint**: yes

### Phase 10: Version History + Section Comments
**Goal**: Users can save and restore proposal versions and leave threaded comments on sections for team review
**Depends on**: Phase 7
**Requirements**: VERSION-01, VERSION-02, VERSION-03, VERSION-04, COMMENT-01, COMMENT-02, COMMENT-03, COMMENT-04
**Success Criteria** (what must be TRUE):
  1. User can save a named version snapshot and view a list of all saved versions with timestamps and the author's name
  2. User can compare any two versions in a side-by-side diff view and restore a previous version as the current draft
  3. User can add a comment on any proposal section and reply to an existing comment in a threaded view
  4. User can mark a comment thread as resolved, and all team members can see and reply to comments on a shared proposal
**Plans**: TBD
**UI hint**: yes

### Phase 11: Win/Loss Tracking + Operator Dashboard
**Goal**: Contractors can log bid outcomes and HCC admins can view aggregate platform usage metrics
**Depends on**: Phase 7 (for team context on proposals; admin dashboard uses existing app_metadata pattern)
**Requirements**: OUTCOME-01, OUTCOME-02, OUTCOME-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. User can log a bid outcome (won / lost / no-bid) on a submitted proposal and view win/loss history on the proposal detail page
  2. User sees aggregate win rate and submission count on their dashboard
  3. HCC admin users can access an operator dashboard showing active users, proposals created, export volume, and weekly/monthly trends
  4. Non-admin users receive a 403 when attempting to access the operator dashboard route (enforced server-side via app_metadata)
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-03-23 |
| 2. Document Ingestion | v1.0 | 4/4 | Complete | 2026-03-23 |
| 3. RFP Analysis | v1.0 | 4/4 | Complete | 2026-03-23 |
| 4. Proposal Drafting + Editor | v1.0 | 5/5 | Complete | 2026-03-24 |
| 5. Export Pipeline | v1.0 | 5/5 | Complete | 2026-03-24 |
| 6. RFP Structure Sidebar | v1.1 | 2/2 | Complete | 2026-03-25 |
| 7. Team Accounts + RBAC | v2.0 | 1/5 | In Progress|  |
| 8. Real-Time Presence | v2.0 | 0/TBD | Not started | - |
| 9. GovRFP Import + SAM.gov Prefill | v2.0 | 0/TBD | Not started | - |
| 10. Version History + Section Comments | v2.0 | 0/TBD | Not started | - |
| 11. Win/Loss Tracking + Operator Dashboard | v2.0 | 0/TBD | Not started | - |
