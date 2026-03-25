# Feature Research — v2.0 Milestone

**Domain:** B2B SaaS — Team Collaboration, Integrations, Analytics for AI-Assisted Government Proposal Writing
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH (official API docs verified; B2B SaaS collaboration patterns verified via multiple sources; GovCon-specific claims verified via 3+ sources)

---

## Scope

This document covers only the **8 new v2.0 features**. Existing v1.x features (RFP upload, AI extraction, compliance matrix, win probability, proposal editor, export, contractor profile, per-seat billing) are already built and are NOT re-researched here.

---

## Feature Landscape

### Feature 1: Multi-User Team Accounts (Invite, RBAC)

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Email invitation flow | Standard B2B onboarding; users expect to invite colleagues by email from within the app without contacting support | LOW | Invite tokens in DB, email via Supabase Auth or Resend; token expiry (7 days is norm) |
| Role assignment at invite time | Inviter picks a role (Owner / Editor / Viewer) when sending — not after acceptance | LOW | Role stored on team membership row, not on user globally |
| Pending invite list + revoke | Users expect to see who was invited but hasn't accepted, and be able to cancel | LOW | Simple DB query on invite table; no complexity |
| Viewer can read but not edit | Read-only enforcement at both UI level (editor disabled) and API level (server-side role check) | MEDIUM | Must gate every editor mutation route — not just the UI |
| Owner can transfer ownership or remove members | Team management without HCC support involvement | LOW | Self-serve member management is an enterprise checkbox item |
| Billing seats linked to team | Adding a member increments the Stripe subscription quantity; removing decrements | MEDIUM | Stripe `subscriptions.update` with `quantity` param; must handle mid-cycle proration |
| Per-proposal access (not just per-team) | Users expect to share one proposal with a guest without giving full team access — even at starter tier | MEDIUM | Proposal-level RBAC is additive to team-level; requires two join tables |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Granular proposal-level permissions | Share a single proposal with a client or subcontractor without full team access — differentiates from basic "org member" models | HIGH | Two-layer RBAC: team membership + proposal membership; edge cases around who can grant proposal access |
| Role audit log | Show owners who did what (section edits, exports, invites) — builds trust for compliance-minded contractors | MEDIUM | Append-only audit table; surface in UI as activity feed |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| SSO / SAML | Larger contractors ask for it | Complexity far exceeds v2 scope; requires enterprise tier pricing justification | Defer to v3 enterprise tier; note it in roadmap |
| Unlimited seats on base plan | Users ask for it | Destroys per-seat revenue model; one paying seat will share with the whole company | Hard seat limit; offer team pricing (e.g., 5-seat bundle) at a discount, not unlimited |
| Custom role definitions | Power users want "approver" or "SME" roles beyond Owner/Editor/Viewer | 3 roles cover 95% of GovCon teams; custom roles are a support nightmare | Ship 3 fixed roles; add "Approver" role in v3 if enterprise customers request it consistently |

---

### Feature 2: Real-Time Co-Editing Presence Indicators

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Avatar/initials shown for active users in the document | Google Docs established this as baseline; users expect to know who is in the document | LOW | Supabase Presence channel; broadcast user name + color on join |
| "User is editing this section" indicator | Prevents two people from overwriting each other's work; directly analogous to Google Docs section lock | MEDIUM | Presence payload includes which section the user's cursor is in; render a colored border on that section |
| Live cursor position (within a section) | Expected in any collaborative editor in 2025; Figma and Google Docs have conditioned users to expect this | HIGH | Requires Tiptap Collaboration extension + Yjs + a WebSocket provider (Hocuspocus or Liveblocks); significant architectural addition |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Presence without full Yjs CRDT | Show WHO is in the document (avatar + section indicator) without requiring the full collaborative CRDT stack; lighter, ships faster | LOW | Supabase Presence channel only; no Yjs; avoids Hocuspocus server cost |
| "Last edited by [user] at [time]" on each section | Accountability in proposal review workflows; proposal managers want this | LOW | Store `last_edited_by` + `last_edited_at` on each section row; surface in editor UI |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full Yjs CRDT real-time co-editing (simultaneous keystrokes) | Users who use Google Docs expect it | Tiptap Collaboration + Hocuspocus requires a persistent WebSocket server; incompatible with Vercel serverless; adds Hocuspocus hosting cost ($99+/mo on Tiptap Cloud) and full CRDT migration of existing content | Ship presence awareness (who is viewing) + section locking (prevent conflicting edits) in v2; evaluate full CRDT for v3 after validating team usage |

**Key constraint:** The existing Tiptap editor stores content as Tiptap JSON in Supabase. Migrating to Yjs document format is a data migration, not a drop-in addition. Presence-only (no CRDT) is the correct v2 scope.

---

### Feature 3: GovRFP One-Click RFP Import

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Single action triggers import with no re-upload | Users expect cross-product workflows to feel seamless; re-uploading a file they already have in GovRFP is friction they will complain about | MEDIUM | GovRFP sends the RFP file (or a reference URL) directly to ProposalAI; ProposalAI creates the proposal row + kicks off the parse job |
| Authenticated handoff (no second login) | Users are already logged in to GovRFP; they should not need to authenticate again in ProposalAI | MEDIUM | Shared Supabase project (same auth schema) enables seamless JWT handoff; OR a short-lived import token if separate Supabase instances |
| Import confirmation screen showing RFP metadata | Users want to confirm what they imported before committing; title, agency, due date | LOW | Display parsed metadata from GovRFP's existing RFP record; user confirms, then triggers analysis |
| Import error handling (file unavailable, auth failure) | Users expect a clear failure message, not a silent redirect | LOW | Standard error state with retry option |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Import with pre-populated win score context from GovRFP | GovRFP may have scored or tagged the RFP; passing that metadata into the ProposalAI analysis enriches the win score with discovery-side context | MEDIUM | Requires a defined data contract between the two products; coordinate with GovRFP schema |
| One-click imports that preserve GovRFP opportunity ID | Linking the two records enables closed-loop tracking (did this opportunity become a won contract?) | LOW | Store `govRfpOpportunityId` on the proposals row; enables win/loss correlation later |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| URL-based RFP scraping from SAM.gov on import | Users want to paste a SAM.gov URL and have it auto-import | SAM.gov HTML structure is unstable; scraping violates ToS risk; API access is the correct path | Use SAM.gov Opportunities API (public) to fetch opportunity data by notice ID; do not scrape HTML |

---

### Feature 4: SAM.gov Entity Data Prefill

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| UEI lookup to pull contractor registration data | Any registered contractor has a UEI; they expect to enter it once and have their registration data populate | LOW | SAM.gov Entity Management API; search by UEI; public data (no sensitive fields) |
| CAGE code, legal name, physical address | Appears on every cover page and form; re-typing it from SAM registration is pure friction | LOW | Available in public API response; straightforward field mapping |
| NAICS code prefill from SAM registration | Contractors maintain their NAICS list in SAM; expect that list to auto-populate into their ProposalAI profile | LOW | `naicsCode` array in API response |
| Business type / socioeconomic status prefill | 8(a), HUBZone, WOSB, SDVOSB status drives win probability and set-aside matching; user expects to not re-enter what is already in SAM | LOW | `sbaBusinessTypes` in API response; map to ProposalAI's existing certification schema |
| Explicit user confirmation before writing | Contractors may have custom data in their profile that differs from SAM registration; prefill must not silently overwrite | LOW | Show diff view or "review changes" modal; user approves field by field or in bulk |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Registration expiration warning | SAM registration expires annually; surfacing "your SAM registration expires in 30 days" is a high-value reminder contractors frequently miss | LOW | `registrationExpirationDate` field in API; compare to today; surface in profile UI |
| Pull active capability narrative from SAM (if present) | SAM entities can include capabilities narrative text; pre-seeding the contractor profile with it reduces onboarding friction | LOW | `entityInformation.entityURL` + `capabilities` fields if populated; treat as starting point, not final |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-sync SAM data on every login | Keeping contractor profile "always in sync" with SAM | Rate limits: 1,000 requests/day per API key; if 500 users log in daily, each triggering a SAM lookup, you hit the limit at scale | Sync on explicit user action ("Refresh from SAM") only; cache last-fetched timestamp; warn if data is older than 90 days |
| Fetch representations and certifications (Reps & Certs) | Useful compliance data | Reps & Certs require individual or system account API key with elevated permissions; public endpoint does not return them | Use only public endpoint fields in v2; note Reps & Certs access requires SAM system account for v3 |

**API constraint (HIGH confidence):** Public SAM.gov Entity API rate limit is 10 requests/day for unauthenticated; 1,000 requests/day for registered individual API key. ProposalAI needs one registered API key stored server-side. At 1,000 users each fetching once, the limit holds; beyond that requires a system account application to GSA.

---

### Feature 5: Version History (Compare Drafts, Restore)

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Automatic version creation on significant change | Users expect their work to be recoverable without thinking about it; "save a version" is an extra mental step they will skip | MEDIUM | Create a version snapshot on: AI section generation, manual export, explicit user "save version" action; NOT on every auto-save keystroke |
| Named versions with timestamps and author | "Version from Monday" is useless; users expect "AI Draft - 2026-03-25 by George" | LOW | `version_name`, `created_at`, `created_by` on version row |
| Restore to a previous version | Core recovery workflow; user made a mistake and wants to roll back | MEDIUM | Copy version snapshot JSON back to the live proposal; current state auto-versioned before restore (safety net) |
| Visual diff between two versions | Side-by-side or inline diff showing what changed between drafts; proposal reviewers use this during red team | HIGH | Diff of Tiptap JSON is non-trivial; use diffing at text level (extracted from Tiptap JSON); libraries like `diff` (npm) work on string output |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| "AI regeneration" versions clearly labeled | When a section is regenerated by AI, that creates a labeled version — distinguishing human edits from AI drafts | LOW | Set `version_type: 'ai_regeneration'` flag on the row; display distinctively in history UI |
| Section-level version history | "Show me only the version history of the Technical Approach section" — not the whole document | HIGH | Requires per-section version snapshots instead of whole-document; significantly more complex storage and diff logic; likely v3 scope |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Unlimited version storage | Users want infinite history | Storage cost grows without bound; for a typical 50-section proposal, each version snapshot is 50–200KB JSON; 100 versions = 20MB per proposal | Cap at 50 versions per proposal; auto-delete oldest when cap exceeded; show "older versions pruned" notice |
| Real-time granular versioning (every keystroke) | Google Docs-style; some users expect it | Extreme DB write amplification; Tiptap's auto-save already runs every 30s; granular versioning is not meaningful for proposal workflows | Snapshot on meaningful events only (AI generation, export, explicit save, restore); 30s auto-save is not a version |

---

### Feature 6: Section Comments / Annotation

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Inline comment anchored to selected text | Google Docs established this as the standard; users expect to highlight text and add a comment that appears in the margin | MEDIUM | Tiptap supports comment marks via custom extension; anchor stores range (from/to positions); must handle position drift when text is edited |
| Comment threads (replies) | Single comments create back-and-forth email chains; users expect in-line conversation | MEDIUM | Comment thread table: parent comment + replies; render as nested in sidebar |
| Resolve / reopen a comment | Proposal managers need to mark comments as addressed; cluttered unresolved threads block review | LOW | `status: 'open' | 'resolved'` on comment row; resolved threads collapsed by default |
| @mention to notify a team member | Users expect to tag a colleague who needs to address a comment | MEDIUM | Parse @name in comment body; look up team member; send notification (email or in-app); requires team accounts to be live |
| Comment author + timestamp visible | Comments without attribution are useless; authors expect their name shown | LOW | Store `author_id` + `created_at`; resolve display name from profiles table |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| AI-generated reviewer comments | "Flag this section as non-compliant with Section L requirement 4.2" — AI acting as a red-team reviewer | HIGH | Trigger Claude call on export or explicit "AI Review" action; return structured comment objects; store as system-authored comments |
| Comment export in Word | Include unresolved comments in the exported .docx as Word comments/tracked changes | HIGH | `docx` npm supports comments via `CommentsExtendedMarkup`; complex implementation but high value for print review |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Video / audio annotation | Some tools offer voice comments | Disproportionate complexity and storage cost for a document tool | Text comments only in v2; emoji reactions are a lightweight engagement signal if needed |
| Comment permissions (private comments) | Some reviewers want comments only visible to specific people | Complex permission overlay on top of RBAC | All comments visible to all team members with proposal access; redaction is not a v2 need |

**Key dependency:** Comments depend on team accounts being live. Solo-user comments exist but have no audience — the value is entirely in team review workflows. Do NOT ship section comments before team accounts.

---

### Feature 7: Win/Loss Tracking (Bid Outcomes)

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Simple outcome logging (Win / Loss / No Bid / Pending) | Contractors track bid outcomes manually in spreadsheets today; this is table stakes for any proposal management tool | LOW | Add `bid_outcome` enum + `outcome_date` + `award_amount` (optional) to proposals table |
| Contract value at award | Win rate in dollars matters more than win rate in count; contractors expect to see both | LOW | Store `award_amount` on the proposal row; user enters post-award |
| Win rate summary dashboard | "I won 4 of 12 proposals this quarter" — basic aggregate; users expect this without exporting to Excel | LOW | Aggregate query over proposals table; surface on dashboard |
| Filter outcomes by date range, agency, NAICS | Basic slicing; contractors manage pipelines by agency and category | MEDIUM | Standard filter UI; all filter dimensions are already stored on the proposals row |
| Loss reason (free text + category) | Contractors want to log debrief notes; "price was too high," "incumbent advantage," etc. | LOW | `loss_reason_category` enum + `loss_notes` text field; category options: Price, Technical, Past Performance, Incumbent, No Bid, Other |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Outcome feeds back into win probability model | This is the unique loop: real outcome data improves the AI win score over time; no affordable GovCon tool does this today | HIGH | Requires: storing outcome + win_probability at submission time; building correlation analysis; reweighting Claude's score factors based on observed accuracy; computationally non-trivial, but the data collection starts now even if the model adjustment comes in v3 |
| "Predicted vs. actual" win score comparison | Show the contractor: "We predicted 72% win probability; you won. Your 70%+ proposals win 68% of the time." — calibration data | MEDIUM | Store `win_probability_at_submission` at export time (snapshot); compare to outcome; surface in analytics |
| Agency win rate breakdown | Which agencies do you win at vs. lose at — segmented by agency name extracted from RFP | MEDIUM | Agency name already extracted during RFP analysis (ANALYZE phase); group outcomes by agency |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automated award tracking via SAM.gov FPDS/USASpending | Pull award data automatically without user logging | FPDS matching requires UEI + solicitation number + award date; false positives on similar solicitation numbers are common; user still needs to verify | Manual outcome logging with a one-click "mark as won/lost" UI; FPDS cross-reference is a v3 enhancement |
| Full CRM pipeline (stages, tasks, contacts) | Some contractors want a full BD CRM | Out of scope; ProposalAI is a proposal writing tool; adding CRM creates a product identity crisis | Keep outcome tracking proposal-focused; recommend HubSpot/Salesforce integration for full CRM needs |

---

### Feature 8: HCC Operator Dashboard (Aggregate Metrics)

#### Table Stakes (Users Expect These)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Active user count (DAU / MAU) | HCC needs to know if people are actually using the product | LOW | Count distinct `user_id` from a usage events table within time window |
| Proposals created per period | Primary product usage metric | LOW | Count rows in proposals table grouped by `created_at` week/month |
| Proposals exported (Word + PDF) | Export = user reached the end of the workflow; highest-signal engagement metric | LOW | Count export events (already log-worthy; add export event row on each export action) |
| Active subscriptions + trial count | Revenue health; HCC needs this to run the business | LOW | Query Stripe or local `subscriptions` table; count by `status: active | trialing` |
| Churn rate (subscriptions canceled in period) | Standard SaaS health metric | LOW | Count `subscription.deleted` events from webhook log |
| Retention: % of users who returned in 30 days | Tells HCC if users come back after first use | MEDIUM | Requires a usage events table with session timestamps; cohort analysis query |

#### Differentiators

| Behavior | Value Proposition | Complexity | Notes |
|----------|-------------------|------------|-------|
| Per-user proposal activity (who uses it most) | HCC wants to identify power users for case studies / testimonials | LOW | Table view sorted by proposals created per user |
| Win rate aggregate across all users | "Our users collectively win X% of proposals they create with ProposalAI" — marketing claim | MEDIUM | Aggregate bid outcomes across all users; requires win/loss tracking (Feature 7) to be live |
| AI usage and cost tracking | HCC needs to know Claude API cost per proposal to validate unit economics | MEDIUM | Log `input_tokens` + `output_tokens` + model per Claude call; compute cost in dashboard using Anthropic pricing constants |
| Export to CSV | HCC may want to analyze data in their own tools | LOW | Standard CSV download of any dashboard table |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time dashboard with sub-second refresh | Feels more impressive | Production DB aggregations on every page load will degrade query performance as user count grows; no operational need for real-time on an internal dashboard | Refresh on page load + manual refresh button; add background materialized view if query becomes slow |
| User-level activity visible to individual users | Users want to see their own stats | This is a SEPARATE user-facing analytics feature — do not conflate with the HCC operator view | Build a separate user stats panel on the user dashboard; keep operator dashboard strictly internal/HCC-only |
| Complex cohort analysis builder | HCC asks for it | Cohort analysis UIs are data warehouse products, not SaaS dashboard features | Ship 4-5 fixed, meaningful metrics tables; export to CSV for ad-hoc analysis in Sheets or Metabase |

**Access control:** The operator dashboard must be gated to HCC admin accounts only, not exposed to any contractor user. Gate via a `role: 'hcc_admin'` flag on the user profile, checked server-side on every dashboard route.

---

## Feature Dependencies

```
[Multi-User Team Accounts]
    └──required by──> [Real-Time Presence Indicators]  (presence has no value for solo users)
    └──required by──> [Section Comments / Annotation]  (@mention, review workflows require teammates)
    └──required by──> [Billing Seat Management]         (already exists; team adds multi-seat sync)

[GovRFP Import]
    └──requires──> [Shared Auth / Supabase project alignment between ProposalAI and GovRFP]

[SAM.gov Prefill]
    └──enhances──> [Contractor Profile]                (existing feature; prefill fills it)
    └──enhances──> [Win Probability Score]             (more accurate NAICS/cert data improves score)

[Win/Loss Tracking]
    └──enables──> [Win Score Feedback Loop]            (v3: outcome data reweights win probability model)
    └──enables──> [HCC Operator Win Rate Aggregate]    (Feature 8 aggregate metric)

[Version History]
    └──independent──> (no hard dependency on other v2 features; can ship standalone)

[HCC Operator Dashboard]
    └──enhanced by──> [Win/Loss Tracking]              (win rate aggregate metric requires outcome data)
```

### Dependency Notes

- **Comments require Team Accounts:** A comment with no teammates to receive @mentions is a note to self; the review workflow only exists in multi-user context. Ship team accounts first.
- **Presence requires Team Accounts:** Showing "George is viewing" requires at least two seats. Ship presence in the same phase or immediately after team accounts.
- **SAM Prefill is standalone:** No dependency on other v2 features; can be included in the same phase as team accounts or separately without risk.
- **GovRFP Import dependency:** If ProposalAI and GovRFP share the same Supabase project, auth handoff is trivial. If separate Supabase instances, a short-lived signed import token is required — this is the primary architectural decision to nail before building.
- **Win/Loss Tracking is standalone but feeds everything:** Collect outcome data now even if the feedback loop model adjustment is v3. The data must exist before the model can learn from it.

---

## v2.0 MVP Definition

### Must Ship Together (Blocking Dependencies)

- [ ] **Multi-User Team Accounts** — the foundation everything else builds on
- [ ] **Real-Time Presence Indicators** — ships with team accounts (same phase); no value without teammates
- [ ] **SAM.gov Entity Prefill** — independent; high user value, low risk; include in first wave

### Ship After Team Foundation

- [ ] **GovRFP One-Click Import** — high strategic value; requires auth handoff decision resolved first
- [ ] **Section Comments / Annotation** — requires team accounts live; ship in second phase wave
- [ ] **Version History** — independent; can ship in second wave with comments

### Can Ship Last

- [ ] **Win/Loss Tracking** — standalone; start data collection as early as possible to build the feedback loop corpus
- [ ] **HCC Operator Dashboard** — internal-only; not user-facing; ship last without blocking others

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-User Team Accounts | HIGH | HIGH | P1 — blocks everything |
| Real-Time Presence Indicators (presence-only, no CRDT) | HIGH | LOW | P1 — ships with team accounts |
| SAM.gov Entity Prefill | HIGH | LOW | P1 — standalone, high ROI |
| GovRFP One-Click Import | HIGH | MEDIUM | P1 — top strategic value |
| Version History | MEDIUM | MEDIUM | P2 — expected, not blocking |
| Section Comments / Annotation | MEDIUM | MEDIUM | P2 — requires team accounts |
| Win/Loss Tracking | MEDIUM | LOW | P2 — data collection must start now |
| HCC Operator Dashboard | LOW (user) / HIGH (HCC) | LOW | P2 — internal tool, low risk |

---

## Complexity Notes for Requirements Writer

| Feature | Hardest Part | Estimated Relative Complexity |
|---------|-------------|-------------------------------|
| Team Accounts | Billing seat sync with Stripe; proposal-level RBAC layered on team-level RBAC | HIGH |
| Presence Indicators | Avoiding full Yjs CRDT migration; presence-only via Supabase channel is LOW | LOW (presence-only scope) |
| GovRFP Import | Auth handoff between two products; data contract between products | MEDIUM |
| SAM.gov Prefill | API key management; rate limit at scale; confirmation UX to avoid overwriting | LOW |
| Version History | Tiptap JSON diff rendering; deciding what triggers a version snapshot | MEDIUM |
| Section Comments | Tiptap comment mark extension; position drift on edit; @mention notification | MEDIUM |
| Win/Loss Tracking | Simple data model; feedback loop reweighting is v3 complexity | LOW |
| HCC Operator Dashboard | Usage events table design; AI cost tracking; access gate | LOW |

---

## Competitor Feature Analysis

| Feature | Loopio / Responsive | Proposify | ProposalAI v2 Approach |
|---------|--------------------|-----------|-----------------------|
| Team accounts + RBAC | YES — core feature; role-based section ownership | YES — basic owner/collaborator | Owner/Editor/Viewer + proposal-level sharing |
| Real-time co-editing | Responsive: presence indicators; not full CRDT | No | Presence-only via Supabase channel (no Yjs CRDT) |
| Version history | YES — content library versioning | Basic draft versions | Snapshot on AI generation + export + explicit save |
| Comments / annotation | YES — inline commenting | YES — basic comments | Tiptap comment extension + @mention |
| SAM.gov integration | No | No | UEI lookup → contractor profile prefill (differentiator) |
| Win/loss tracking | No native | Basic win/loss log | Outcome logging + win score calibration loop (unique) |
| Operator dashboard | Yes — enterprise reporting | Basic account metrics | HCC-specific aggregate metrics + AI cost tracking |
| RFP source integration | No | No | GovRFP direct import (HCC ecosystem advantage) |

---

## Sources

- SAM.gov Entity Management API official docs: https://open.gsa.gov/api/entity-api/
- SAM.gov rate limits detail: https://govconapi.com/sam-gov-rate-limits-reality
- Tiptap Collaboration (Yjs/presence): https://tiptap.dev/docs/collaboration/core-concepts/awareness
- Tiptap CollaborationCaret: https://tiptap.dev/docs/editor/extensions/functionality/collaboration-caret
- Supabase Realtime Presence: https://supabase.com/docs/guides/realtime/presence
- Supabase Realtime Cursor component: https://supabase.com/ui/docs/nextjs/realtime-cursor
- Liveblocks + Tiptap guide: https://liveblocks.io/docs/guides/how-to-create-a-collaborative-text-editor-with-tiptap-yjs-nextjs-and-liveblocks
- PropelAuth RBAC guide: https://www.propelauth.com/post/guide-to-rbac-for-b2b-saas
- WorkOS RBAC providers 2025: https://workos.com/blog/top-rbac-providers-for-multi-tenant-saas-2025
- Government proposal software comparison 2025: https://www.inventive.ai/blog-posts/comparison-of-government-ai-rfp-response-software
- Loopio collaboration features: https://loopio.com/blog/best-proposal-software/
- Win/loss analysis best practices: https://www.ostglobalsolutions.com/improve-your-Government-proposals-pwin-follow-proposal-management-best-practices/
- B2B SaaS collaboration trends 2025: https://www.iccube.com/blog/b2b-saas-trends-for-2025-what-product-and-r-d-managers-need-to-know
- Secure collaboration patterns: https://securityboulevard.com/2025/10/what-secure-collaboration-looks-like-in-authenticated-saas-apps/

---

*Feature research for: HCC ProposalAI v2.0 — Team Collaboration, Integrations, Analytics*
*Researched: 2026-03-25*
