# Requirements: HCC ProposalAI v2.0

**Defined:** 2026-03-25
**Core Value:** Reduce time from RFP receipt to first compliant proposal draft from days to under 30 minutes, with compliance gaps surfaced automatically so nothing is missed.

## v2.0 Requirements

Requirements for the v2.0 Collaboration + Integrations milestone.

### Team Accounts + RBAC

- [ ] **TEAM-01**: User can create a team and become the team owner
- [ ] **TEAM-02**: Owner can invite teammates by email with an assigned role (editor / viewer)
- [ ] **TEAM-03**: Invited user receives an email and can accept or decline the invite
- [ ] **TEAM-04**: Owner can change a team member's role after joining
- [ ] **TEAM-05**: Owner can remove a team member from the team
- [ ] **TEAM-06**: Team members can view and edit proposals shared with their team (scoped by role)
- [ ] **TEAM-07**: Stripe seat count increments on invite acceptance and decrements on member removal

### Real-Time Presence

- [ ] **PRES-01**: User sees avatar indicators showing who is currently viewing the same proposal
- [ ] **PRES-02**: Presence indicators update in real-time as viewers join and leave
- [ ] **PRES-03**: Only team members of a proposal can observe its presence channel (private channel + RLS)

### GovRFP Import

- [ ] **IMPORT-01**: User can import an RFP from GovRFP into ProposalAI with one click
- [ ] **IMPORT-02**: Import creates a new proposal pre-populated with the RFP title, description, and deadline from GovRFP
- [ ] **IMPORT-03**: Import uses a server-to-server signed token (5-minute TTL) — no raw shared secrets in client code

### SAM.gov Prefill

- [ ] **SAM-01**: User can enter their UEI or CAGE code in their contractor profile
- [ ] **SAM-02**: System fetches and prefills certifications and NAICS codes from SAM.gov entity data
- [ ] **SAM-03**: SAM.gov entity data is cached per contractor for 30 days to respect API rate limits

### Version History

- [ ] **VERSION-01**: User can save a named version snapshot of a proposal at any time
- [ ] **VERSION-02**: User can view the full list of saved versions with timestamps and author name
- [ ] **VERSION-03**: User can compare any two versions in a side-by-side diff view
- [ ] **VERSION-04**: User can restore any previous version as the current draft

### Section Comments

- [ ] **COMMENT-01**: User can add a comment on any proposal section
- [ ] **COMMENT-02**: Users can reply to a comment (threaded replies)
- [ ] **COMMENT-03**: User can mark a comment thread as resolved
- [ ] **COMMENT-04**: All team members can see and reply to comments on a shared proposal

### Win/Loss Tracking

- [ ] **OUTCOME-01**: User can log a bid outcome (won / lost / no-bid) on a submitted proposal
- [ ] **OUTCOME-02**: Win/loss history is visible on the proposal detail page
- [ ] **OUTCOME-03**: Aggregate win rate and submission count are shown on the user dashboard

### HCC Operator Dashboard

- [ ] **ADMIN-01**: HCC admin users can access an operator dashboard (role enforced server-side via Supabase `app_metadata.hcc_admin`)
- [ ] **ADMIN-02**: Dashboard shows active users, proposals created, and export volume
- [ ] **ADMIN-03**: Dashboard shows weekly and monthly time-series trends
- [ ] **ADMIN-04**: Non-admin users receive a 403 response when attempting to access the dashboard route

## Future Requirements

Deferred to v3.0 or later.

### Full Co-Editing (CRDT)

- **COEDIT-01**: Multiple users can simultaneously edit the same section with operational transform conflict resolution
- **COEDIT-02**: Each user's cursor and selection is visible to collaborators in real-time

*Deferred reason: Requires Hocuspocus WebSocket server (separate Railway deployment), data migration away from plain Tiptap JSON JSONB storage, and persistent connection infrastructure. Supabase Presence-only (PRES-01–03) delivers the visible team value at zero additional infrastructure cost.*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Yjs CRDT co-editing (v2) | Requires persistent WebSocket server incompatible with Vercel serverless; Tiptap JSON format migration required; defer to v3 |
| Tiptap Pro Comments extension | Paywalled — requires Tiptap Platform subscription at undisclosed sales price; custom CommentMark extension covers the same user need |
| SAM.gov Reps & Certs (full section) | Requires federal system account; individual API key covers entity data + NAICS + basic certifications which is sufficient for v2 |
| Direct portal submission (SAM.gov/agency) | Legal complexity + agency-specific formats; out of scope permanently |
| Custom AI fine-tuning | Claude API with prompt engineering sufficient; fine-tuning adds cost without clear upside at current scale |
| Freemium tier | Per-seat + trial validated; freemium adds support cost without revenue |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEAM-01 | Phase 7 | Pending |
| TEAM-02 | Phase 7 | Pending |
| TEAM-03 | Phase 7 | Pending |
| TEAM-04 | Phase 7 | Pending |
| TEAM-05 | Phase 7 | Pending |
| TEAM-06 | Phase 7 | Pending |
| TEAM-07 | Phase 7 | Pending |
| PRES-01 | Phase 8 | Pending |
| PRES-02 | Phase 8 | Pending |
| PRES-03 | Phase 8 | Pending |
| IMPORT-01 | Phase 9 | Pending |
| IMPORT-02 | Phase 9 | Pending |
| IMPORT-03 | Phase 9 | Pending |
| SAM-01 | Phase 9 | Pending |
| SAM-02 | Phase 9 | Pending |
| SAM-03 | Phase 9 | Pending |
| VERSION-01 | Phase 10 | Pending |
| VERSION-02 | Phase 10 | Pending |
| VERSION-03 | Phase 10 | Pending |
| VERSION-04 | Phase 10 | Pending |
| COMMENT-01 | Phase 10 | Pending |
| COMMENT-02 | Phase 10 | Pending |
| COMMENT-03 | Phase 10 | Pending |
| COMMENT-04 | Phase 10 | Pending |
| OUTCOME-01 | Phase 11 | Pending |
| OUTCOME-02 | Phase 11 | Pending |
| OUTCOME-03 | Phase 11 | Pending |
| ADMIN-01 | Phase 11 | Pending |
| ADMIN-02 | Phase 11 | Pending |
| ADMIN-03 | Phase 11 | Pending |
| ADMIN-04 | Phase 11 | Pending |

**Coverage:**
- v2.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 — roadmap created, all 31 requirements mapped to phases 7–11*
