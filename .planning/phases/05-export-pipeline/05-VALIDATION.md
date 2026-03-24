---
phase: 5
slug: export-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/export/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/export/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | EXPORT-01, EXPORT-02 | unit stubs | `npx vitest run tests/export/` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | EXPORT-01 | unit | `npx vitest run tests/export/tiptap-to-docx.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | EXPORT-01 | integration | `npx vitest run tests/export/export-docx-route.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | EXPORT-02 | unit | `npx vitest run tests/export/tiptap-to-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | EXPORT-02 | integration | `npx vitest run tests/export/export-pdf-route.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | EXPORT-01, EXPORT-02 | e2e/manual | human verify | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/export/tiptap-to-docx.test.ts` — stubs for EXPORT-01 converter
- [ ] `tests/export/export-docx-route.test.ts` — stubs for EXPORT-01 API route
- [ ] `tests/export/tiptap-to-pdf.test.ts` — stubs for EXPORT-02 converter
- [ ] `tests/export/export-pdf-route.test.ts` — stubs for EXPORT-02 API route

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Word file opens in Microsoft Word on Windows with correct heading styles | EXPORT-01 | Requires real Office install | Download .docx, open in Word, verify H1/H2 styles in Styles panel |
| PDF fonts and layout consistent across environments | EXPORT-02 | Requires visual inspection | Download PDF, open in browser and PDF viewer, compare layout |
| Export buttons visible and functional in editor page | EXPORT-01, EXPORT-02 | React component with SSE deps | Navigate to editor page, click Download Word / Download PDF |

---

## Validation Architecture

Wave 0 creates 4 test stub files. Plans 02 and 03 implement the converters + routes with TDD (RED-GREEN pattern). Plan 04 performs human verification of the complete download flow.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
