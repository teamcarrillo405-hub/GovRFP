---
phase: 01-foundation
plan: "04"
subsystem: contractor-profile
tags: [profile, crud, zod, supabase, rls, server-actions]
dependency_graph:
  requires: ["01-01", "01-02", "01-03"]
  provides: ["profile-data-for-ai-drafts", "past-projects-store", "key-personnel-store"]
  affects: ["04-ai-drafting"]
tech_stack:
  added: []
  patterns:
    - "Zod 4 .issues (not .errors) for error message extraction"
    - "Server Actions with FormData for all profile CRUD"
    - "Client wrapper components (PastProjectsClient, KeyPersonnelClient) for interactive CRUD"
    - "contract_value stored as cents (bigint) — convert to/from dollars in form layer"
key_files:
  created:
    - src/lib/validators/profile.ts
    - src/app/(dashboard)/profile/actions.ts
    - src/app/(dashboard)/profile/page.tsx
    - src/components/profile/profile-form.tsx
    - src/app/(dashboard)/profile/past-projects/actions.ts
    - src/app/(dashboard)/profile/past-projects/page.tsx
    - src/components/profile/past-project-form.tsx
    - src/components/profile/past-projects-client.tsx
    - src/app/(dashboard)/profile/key-personnel/actions.ts
    - src/app/(dashboard)/profile/key-personnel/page.tsx
    - src/components/profile/key-personnel-form.tsx
    - src/components/profile/key-personnel-client.tsx
    - src/app/(dashboard)/dashboard/page.tsx
  modified: []
decisions:
  - "Client wrapper pattern (e.g. PastProjectsClient) used instead of embedding client logic in server page — keeps RSC benefits while enabling interactive CRUD without full-page round-trips"
  - "window.location.reload() used after create/update to refresh server-rendered data — acceptable for MVP; replace with router.refresh() or optimistic updates in a future phase"
metrics:
  duration_seconds: 294
  completed_date: "2026-03-23T17:23:19Z"
  tasks_completed: 2
  files_created: 13
  files_modified: 0
---

# Phase 01 Plan 04: Contractor Profile Editor Summary

**One-liner:** Full contractor profile CRUD (company info, certifications, NAICS codes, past projects, key personnel, capability statement) with Zod 4 validation and Supabase RLS enforcement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Zod validators, profile page, server actions, profile form | 5aa990e | validators/profile.ts, profile/actions.ts, profile/page.tsx, profile-form.tsx |
| 2 | Past projects CRUD, key personnel CRUD, dashboard landing page | 29e12c5 | 9 files (see key_files above) |

## What Was Built

**Zod validators** (`src/lib/validators/profile.ts`): Three schemas — `profileSchema` (company_name required, certifications enum array, naics_codes 6-digit regex, capability_statement max 2000), `pastProjectSchema` (all optional except contract_value as cents integer), `keyPersonnelSchema` (name required, certifications as text array). Exports TypeScript types for all three.

**Profile page + form** (`/profile`): Server component loads profile data via `getProfile()`. Client `ProfileForm` has certifications checkbox group (8(a), HUBZone, SDVOSB, WOSB, SDB), comma-separated NAICS input, capability statement textarea with live `{n}/2000` counter. Submit calls `updateProfile` server action. Navigation links to Past Projects and Key Personnel sub-pages.

**Past projects** (`/profile/past-projects`): Server actions for `getPastProjects`, `createPastProject`, `updatePastProject`, `deletePastProject`. Client wrapper (`PastProjectsClient`) renders project list with edit/delete buttons and toggles form inline. Form handles dollar-to-cents conversion on submit and cents-to-dollar on display. RLS enforced via `user_id = auth.uid()` on all write/delete operations.

**Key personnel** (`/profile/key-personnel`): Same pattern. Server actions for CRUD, `KeyPersonnelClient` for interactive list. Certifications stored as text array (comma-separated input → split on submit).

**Dashboard** (`/dashboard`): Welcome page with profile completion progress bar tracking 4 fields (company_name, certifications, naics_codes, capability_statement). Navigation grid to Edit Profile, Past Projects, Key Personnel, Account Settings. No emojis per design rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod 4 .issues vs .errors**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Plan specified `parsed.error.errors[0].message` but Zod 4 changed the API to `.issues` — `.errors` does not exist on `ZodError` in Zod 4.3.x
- **Fix:** Changed all `parsed.error.errors[0].message` to `parsed.error.issues[0].message` in all three actions files
- **Files modified:** `src/app/(dashboard)/profile/actions.ts`, `src/app/(dashboard)/profile/past-projects/actions.ts`, `src/app/(dashboard)/profile/key-personnel/actions.ts`
- **Commit:** included in 5aa990e and 29e12c5

**2. [Rule 2 - Missing functionality] Client wrapper components for interactive CRUD**
- **Found during:** Task 2
- **Issue:** Plan specified server component pages with "Add Project" button and edit/delete per card but server components cannot hold interactive state. A purely server-rendered approach would require full-page navigations for every CRUD interaction.
- **Fix:** Added `PastProjectsClient` and `KeyPersonnelClient` client wrapper components. Server page passes initial data and delete server action; client manages show/hide form state and optimistic delete.
- **Files added:** `src/components/profile/past-projects-client.tsx`, `src/components/profile/key-personnel-client.tsx`
- **Commit:** 29e12c5

## Known Stubs

None. All four profile data fields (company info, past projects, key personnel, capability statement) are wired to Supabase reads/writes. No placeholder data flows to the UI.

## Self-Check: PASSED

Files verified:
- src/lib/validators/profile.ts — FOUND
- src/app/(dashboard)/profile/actions.ts — FOUND
- src/app/(dashboard)/profile/page.tsx — FOUND
- src/components/profile/profile-form.tsx — FOUND
- src/app/(dashboard)/profile/past-projects/actions.ts — FOUND
- src/app/(dashboard)/profile/past-projects/page.tsx — FOUND
- src/components/profile/past-project-form.tsx — FOUND
- src/components/profile/past-projects-client.tsx — FOUND
- src/app/(dashboard)/profile/key-personnel/actions.ts — FOUND
- src/app/(dashboard)/profile/key-personnel/page.tsx — FOUND
- src/components/profile/key-personnel-form.tsx — FOUND
- src/components/profile/key-personnel-client.tsx — FOUND
- src/app/(dashboard)/dashboard/page.tsx — FOUND

Commits verified: 5aa990e, 29e12c5

`npx tsc --noEmit` — PASSED (no errors)
