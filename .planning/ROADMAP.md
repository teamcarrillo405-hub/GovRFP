# Roadmap: HCC ProposalAI

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-03-24)
- 🔄 **v1.1 RFP Structure Sidebar** — Phase 6 (in progress)
- 📋 **v2.0 Collaboration + Integrations** — Phases 7+ (planned)

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

### 🔄 v1.1 RFP Structure Sidebar

- [ ] **Phase 6: RFP Structure Sidebar** — Collapsible sidebar in the editor showing parsed RFP sections and requirements with click-to-scroll navigation

### 📋 v2.0 Collaboration + Integrations (Planned)

*Phases TBD — run `/gsd:new-milestone` to begin requirements and roadmap*

## Phase Details

### Phase 6: RFP Structure Sidebar
**Goal**: Contractors can see the parsed RFP outline at all times while editing their proposal and navigate directly to any section
**Depends on**: Phase 4 (Tiptap editor), Phase 2 (rfp_structure JSONB in proposals table)
**Requirements**: SIDEBAR-01, SIDEBAR-02, SIDEBAR-03, SIDEBAR-04, SIDEBAR-05, SIDEBAR-06, SIDEBAR-07
**Success Criteria** (what must be TRUE):
  1. User opens the proposal editor and sees a sidebar panel listing every parsed RFP section with its title and a requirement count badge, without making any additional API calls
  2. User clicks the sidebar toggle button and the sidebar smoothly opens or closes, with the editor expanding to fill the reclaimed space
  3. User clicks a section heading in the sidebar and the proposal editor scrolls to that section
  4. User scrolls through the proposal editor and the currently visible section is highlighted in the sidebar automatically
  5. User expands a section in the sidebar to see its individual requirements listed underneath, and can collapse it to hide them
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-03-23 |
| 2. Document Ingestion | v1.0 | 4/4 | Complete | 2026-03-23 |
| 3. RFP Analysis | v1.0 | 4/4 | Complete | 2026-03-23 |
| 4. Proposal Drafting + Editor | v1.0 | 5/5 | Complete | 2026-03-24 |
| 5. Export Pipeline | v1.0 | 4/4 | Complete | 2026-03-24 |
| 6. RFP Structure Sidebar | v1.1 | 0/? | Not started | - |
