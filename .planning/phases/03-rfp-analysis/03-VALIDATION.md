---
phase: 3
slug: rfp-analysis
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 (existing from Phase 1) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/analysis/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (all unit — no live Claude API calls) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/analysis/`
- **After every plan wave:** Run `npx vitest run` (full suite — must remain green)
- **Before `/gsd:verify-work`:** Full suite green + manual smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | ANALYZE-01–05 | setup | `npx vitest run tests/analysis/` | ❌ W0 | ⬜ pending |
| 3-xx-xx | TBD | TBD | ANALYZE-04 | unit | `npx vitest run tests/analysis/set-aside-detector.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-xx | TBD | TBD | ANALYZE-03 | unit | `npx vitest run tests/analysis/win-score.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-xx | TBD | TBD | ANALYZE-05 | unit | `npx vitest run tests/analysis/section-lm-detector.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-xx | TBD | TBD | INGEST-04 ext | unit | `npx vitest run tests/analysis/analysis-job-queue.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-xx | TBD | TBD | ANALYZE-02 | unit | `npx vitest run tests/analysis/rfp-analysis-schema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All analysis test files are missing. These must exist before execution begins:

- [ ] `tests/analysis/set-aside-detector.test.ts` — stubs for ANALYZE-01, ANALYZE-04 (regex detection)
- [ ] `tests/analysis/win-score.test.ts` — stubs for ANALYZE-03 (computed factor scoring)
- [ ] `tests/analysis/section-lm-detector.test.ts` — stubs for ANALYZE-05 (Section L/M regex)
- [ ] `tests/analysis/analysis-job-queue.test.ts` — stubs for job_type column extension
- [ ] `tests/analysis/rfp-analysis-schema.test.ts` — stubs for rfp_analysis migration structure

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude API returns structured requirements JSON via tool_use | ANALYZE-01 | Requires live ANTHROPIC_API_KEY + real RFP text | Upload a known government RFP, wait for analysis job to complete, verify `rfp_analysis.requirements` array is non-empty with correct classification values |
| Compliance matrix populated with proposal section mappings | ANALYZE-02 | Requires live Claude API call | Check `rfp_analysis.compliance_matrix` after analysis completes; verify each requirement has a `proposal_section` value |
| Win probability score reflects contractor profile | ANALYZE-03 | Requires live Claude API + profile data | Create a profile with 8(a) cert, upload an 8(a) set-aside RFP, verify `win_score >= 70` and `certifications_match = 90` |
| Analysis job auto-triggered after document job completes | INGEST-04 ext | Requires live Supabase Edge Functions | Upload a PDF, monitor `document_jobs` table — verify a second `job_type='analysis'` row appears after document job completes |
| ANTHROPIC_API_KEY correctly set in Edge Function secrets | ANALYZE-01 | Requires Supabase dashboard access | Run `supabase secrets list` and confirm `ANTHROPIC_API_KEY` is present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
