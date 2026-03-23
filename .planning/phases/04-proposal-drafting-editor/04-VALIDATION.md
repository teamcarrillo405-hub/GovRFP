---
phase: 4
slug: proposal-drafting-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 (existing from Phase 1) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/drafting/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (unit tests — no live Claude API calls) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/drafting/`
- **After every plan wave:** Run `npx vitest run` (full suite — must remain 102+ green)
- **Before `/gsd:verify-work`:** Full suite green + manual streaming smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | DRAFT-01–06, EDITOR-01–04 | setup | `npx vitest run tests/drafting/` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | DRAFT-01–05 | unit | `npx vitest run tests/drafting/draft-route.test.ts` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | DRAFT-06 | unit | `npx vitest run tests/drafting/regenerate.test.ts` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | EDITOR-02 | unit | `npx vitest run tests/drafting/auto-save.test.ts` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | EDITOR-03,04 | unit | `npx vitest run tests/drafting/compliance-gap.test.ts` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | EDITOR-01 | unit | `npx vitest run tests/drafting/tiptap-schema.test.ts` | ❌ W0 | ⬜ pending |
| 4-xx-xx | TBD | TBD | DB migration | unit | `npx vitest run tests/drafting/proposal-sections-schema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All drafting test files are missing. These must exist before execution begins:

- [ ] `tests/drafting/draft-route.test.ts` — stubs for DRAFT-01–05: request validation, profile injection shape, subscription gate (402), auth guard (401)
- [ ] `tests/drafting/regenerate.test.ts` — stubs for DRAFT-06: instruction field passing, section name validation
- [ ] `tests/drafting/auto-save.test.ts` — stubs for EDITOR-02: 30s debounce logic, upsert shape, timestamp update
- [ ] `tests/drafting/compliance-gap.test.ts` — stubs for EDITOR-03, EDITOR-04: keyword scan logic, ComplianceGap mark application, strip utility
- [ ] `tests/drafting/tiptap-schema.test.ts` — stubs for EDITOR-01: Tiptap JSON schema validation, required extension presence
- [ ] `tests/drafting/proposal-sections-schema.test.ts` — stubs for DB migration: table structure, unique constraint on (proposal_id, section_name), RLS

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude streams section draft into editor without UI freeze | DRAFT-01 | Requires live ANTHROPIC_API_KEY + browser interaction | Generate Executive Summary from a proposal with `status = 'analyzed'`; confirm text streams smoothly into editor, no browser freeze |
| All 5 sections generate with correct profile data injected | DRAFT-01–05 | Requires live Claude API + populated contractor profile | Create a profile with 8(a) cert + 3 past projects + 2 key personnel; generate each section; verify certifications and personnel appear in output |
| Section regeneration with instruction changes content | DRAFT-06 | Requires live Claude API | Generate Technical Approach, then regenerate with instruction "focus on cybersecurity"; verify content shifts without losing Tiptap JSON structure |
| Auto-save triggers every 30s and shows timestamp | EDITOR-02 | Requires browser interaction + live Supabase | Edit section text, wait 30s; verify "Saved at HH:MM:SS" appears without manual save action |
| Compliance gap highlights appear on unaddressed requirements | EDITOR-04 | Requires live `rfp_analysis` data + Tiptap rendering | Upload an RFP, run analysis, generate a section; verify yellow highlights appear on paragraphs not covering mandatory requirements |
| ANTHROPIC_API_KEY resolves in Next.js App Router route | DRAFT-01 | Requires `.env.local` setup | Run `npm run dev`, POST to `/api/draft/generate`; confirm non-401, non-500 response (not undefined key error) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
