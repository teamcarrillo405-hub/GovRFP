# Feature Research

**Domain:** AI-assisted RFP/Government Proposal Writing SaaS
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (multiple sources, some competitor pages inaccessible; GovCon-specific claims verified via 3+ sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PDF + DOCX RFP upload | Every RFP arrives as a PDF or Word file; no upload = no product | LOW | Must handle scanned PDFs gracefully; OCR fallback needed for image-only PDFs |
| AI requirement extraction | Core premise — "shred" the RFP into discrete shall/must/will statements | MEDIUM | Section L (instructions) and Section M (evaluation criteria) must be distinguished; FAR Part 15 terminology matters |
| Compliance matrix generation | Every GovCon professional expects this as a deliverable; it's the first thing a proposal manager builds manually today | MEDIUM | Must map each requirement to a proposal section; flag unaddressed items; "shall/must/will" parsing rules matter |
| Mandatory vs. desired requirement flagging | Evaluators distinguish these; contractors need to triage effort accordingly | LOW | Relatively straightforward classification once extraction is done |
| AI-drafted proposal sections | The primary time-saver; users expect Executive Summary, Technical Approach, Management Plan, Past Performance at minimum | HIGH | Quality of output depends heavily on contractor profile data injected into context; hallucination prevention is critical |
| In-browser rich text editor | Contractors must edit AI output; downloading, editing, re-uploading creates friction that kills adoption | MEDIUM | TipTap or Lexical are the standard choices; must support headings, bullets, tables |
| Compliance matrix live-linked to editor | Users expect to see which requirements are covered as they write; this is the core workflow loop | MEDIUM | Requires real-time mapping logic between editor content and requirement checklist |
| Auto-save | Losing work in a proposal tool is career-damaging; contractors expect this | LOW | Debounced saves to Supabase every 30-60 seconds |
| Export to Word (.docx) | Submissions require Word format; many agency portals accept only Word | MEDIUM | Preserving heading styles, page numbering, and tables is the hard part; docx libraries have edge cases |
| Export to PDF | Required for print review, internal distribution, and some portals | LOW | PDF export is simpler than .docx; html-to-pdf or headless browser approach |
| Contractor profile (certifications, NAICS, past projects) | AI drafts are generic without this; contractors expect their company data to appear in every draft | MEDIUM | Structured schema needed: certifications (8(a), HUBZone, SDVOSB, WOSB), NAICS codes, capability statement narrative, past project records, key personnel bios |
| Profile data injected into AI drafts | Proposal sections must reference the actual contractor, not placeholder text | MEDIUM | Context injection at prompt time; profile data must be structured enough to be selectively relevant |
| Per-account document storage | Contractors work on multiple active proposals; they expect their work to persist | LOW | Supabase storage; RLS policy per user account |
| Secure account access | Proposals contain sensitive pricing and strategy; login security is assumed | LOW | Supabase Auth; standard email/password + email verification |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required out of the box, but valued by the target market.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Win probability score (pWin) with reasoning | Contractors make go/no-bid decisions before spending 40+ hours on a proposal; a scored explanation (scope alignment, cert match, competition level) is directly actionable | MEDIUM | AI-generated 0-100 score with 4-5 factor breakdown; not just a number — the reasoning is what contractors use. Competitors like CLEATUS and GovDash offer this; it's becoming table stakes for GovCon-specific tools but absent from general RFP tools like Loopio/Responsive |
| Small business certification matching | 8(a), HUBZone, SDVOSB, WOSB status affects evaluation weighting; surfacing when an RFP has set-aside preferences and matching them to the contractor's profile is a direct win signal | LOW | Parsing set-aside type from solicitation header; cross-referencing contractor certification profile |
| Section L/M cross-reference mapping | Many GovCon proposal managers manually build L-to-M crosswalk tables; automating this saves 2-4 hours per proposal and reduces evaluation risk | MEDIUM | Extract L instructions and M evaluation criteria separately, then map L requirements to M evaluation factors; present as a crosswalk table |
| Past performance auto-narrative | Contractors repeatedly rewrite the same project descriptions for every proposal; storing structured past project data and auto-generating narratives tailored to the current RFP's scope is a significant time-saver | MEDIUM | Requires structured past project schema (contract value, scope, agency, period, outcome, NAICS); prompt must tailor the narrative to the current solicitation's evaluation criteria |
| Compliance gap highlighting in editor | Surfacing exactly which requirements are not addressed while editing — not after — prevents missed requirements at submission | MEDIUM | Real-time or near-real-time analysis; could be done on section save rather than keystroke to manage API cost |
| Section-level regeneration with custom instructions | When a section misses the mark, contractors want to regenerate it with direction ("focus on cybersecurity experience") without redoing the whole proposal | LOW | Already a stated PROJECT.md requirement; differentiating because most document tools don't offer in-place AI regeneration with instructions |
| RFP structure sidebar during editing | Keeping the RFP requirements visible while editing reduces tab-switching; reduces missed requirements | LOW | Parsed RFP outline rendered in a collapsible sidebar panel |
| HCC/small business community framing | HCC members get a tool built for their profile (minority-owned, small business, California-based contractors); community branding and relevant cert language built in | LOW | Marketing differentiator as much as feature differentiator; profile defaults, onboarding copy, help text all tuned to this persona |

---

### Anti-Features (Deliberately Excluded)

Features that seem good, commonly requested, or present in competitors — but should not be built in MVP.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-user team collaboration | Proposal teams involve writers, SMEs, reviewers, and managers | Adds auth/permissions complexity (role-based access, section ownership, conflict resolution), multiplies edge cases, and delays validation of the core solo workflow | Defer to v2 after validating solo workflow; solo users can share exported Word/PDF for external review |
| Direct portal submission (SAM.gov, PIEE, etc.) | Contractors want one-click submission | Each portal has different auth, form schemas, and file requirements; legal liability if submission fails or is malformed; portals change without notice | Export a submission-ready document; let the contractor submit manually |
| RFP discovery / opportunity search | Contractors want to find and respond in one tool | Separate product concern (GovRFP already handles this); complicates pricing, scope, and user flow | Deep-link from GovRFP to ProposalAI when user wants to respond to a found opportunity |
| Custom AI model fine-tuning | Users ask for "training on my past proposals" | Expensive, slow, requires data pipeline, and Claude API with long context handles this via in-context injection already; real fine-tuning offers diminishing returns for this use case | Use contractor profile + past proposal content as context in Claude API calls |
| Real-time collaborative editing (Google Docs-style) | Teams expect modern collaboration | Requires operational transformation (OT) or CRDT algorithms, significant infrastructure, and creates conflict resolution UI complexity; not needed for solo MVP | Auto-save + version history for solo users; export for async review |
| Automated pricing/price narrative generation | Contractors want help with price volumes | Pricing is highly context-specific, legally sensitive, and varies by contract type (FFP, T&M, CPFF); AI errors here create legal and financial exposure | Provide price narrative section template in editor; AI assists with narrative framing only, not numbers |
| Email/CRM integration | Enterprise tools have Salesforce connectors | Adds integration maintenance, auth complexity, and is not needed by small contractors who are the target market | Manual data entry for contractor profile; integration via export/import in future |
| Version history with full diff view | Power users want tracked changes | Adds UI/database complexity; not essential for solo MVP | Auto-save with timestamps; last-saved state is sufficient for v1 |
| Freemium / free tier | Broad top-of-funnel acquisition | Attracts non-serious users, increases infrastructure cost per user, and complicates conversion tracking for a B2B niche product; per-seat pricing aligns with GovCon budget norms | Per-seat monthly subscription; 14-day trial period instead |

---

## Feature Dependencies

```
[Contractor Profile]
    └──required by──> [AI Proposal Drafting]
                           └──required by──> [Section Regeneration]
                           └──required by──> [Past Performance Narrative]

[RFP Upload + Parsing]
    └──required by──> [Compliance Matrix]
                           └──required by──> [Compliance Gap Highlighting in Editor]
                           └──required by──> [Section L/M Cross-reference]

    └──required by──> [Win Probability Score]

    └──required by──> [RFP Structure Sidebar]

[AI Proposal Drafting]
    └──requires──> [RFP Upload + Parsing]
    └──requires──> [Contractor Profile]

[In-Browser Rich Text Editor]
    └──required by──> [Compliance Gap Highlighting in Editor]
    └──required by──> [Section Regeneration]

[Export (.docx / PDF)]
    └──requires──> [In-Browser Rich Text Editor]

[Accounts + Auth]
    └──required by──> [Document Storage]
    └──required by──> [Contractor Profile]
    └──required by──> [Billing]
```

### Dependency Notes

- **AI Proposal Drafting requires Contractor Profile:** Generic AI output (no certifications, no past projects) is rejected by contractors immediately. Profile data must be in place before drafting is useful.
- **Compliance Gap Highlighting requires both Compliance Matrix and Rich Text Editor:** The matrix provides the requirement set; the editor provides the content to check against. Neither alone enables live gap detection.
- **Win Probability Score requires RFP Parsing:** The score factors (scope alignment, set-aside match, competition level) are derived from parsed RFP content cross-referenced with the contractor profile.
- **Export requires Editor:** The editor is the single source of truth for proposal content; export renders the editor state.
- **Document Storage requires Auth:** Storage must be scoped per user account via row-level security; no auth = no safe isolation of sensitive proposal documents.

---

## MVP Definition

### Launch With (v1)

These are the features that make the product legible and valuable from day one. Without any of these, the product does not fulfill its core promise.

- [ ] PDF + DOCX RFP upload — no upload, no product
- [ ] AI requirement extraction (shall/must/will statements, Section L/M separation) — the foundational parse step
- [ ] Compliance matrix generation with mandatory/desired flagging — first deliverable contractors expect
- [ ] Contractor profile (certifications, NAICS, past projects, key personnel, capability statement) — required for non-generic AI output
- [ ] AI-drafted proposal sections (Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative) — core time-saver
- [ ] Section-level regeneration with custom instructions — essential for iterating on weak sections
- [ ] In-browser rich text editor with auto-save — editing without downloading is the modern expectation
- [ ] RFP structure sidebar — keeps requirements visible during editing
- [ ] Compliance matrix live-linked to editor (requirement coverage status) — closes the compliance loop
- [ ] Win probability score (0-100) with 4-5 factor reasoning — go/no-bid decision support; differentiates from general RFP tools
- [ ] Export to Word (.docx) — submission format required by most agencies
- [ ] Export to PDF — review and internal distribution
- [ ] Per-seat subscription billing (Stripe) — revenue model
- [ ] Solo account auth + secure document storage — basic security and persistence

### Add After Validation (v1.x)

Add once core workflow is validated by paying users.

- [ ] Section L/M cross-reference crosswalk table — high value for experienced proposal managers; builds on existing parsing
- [ ] Past performance auto-narrative tailored to current RFP scope — high value, moderate complexity; needs past project schema in place
- [ ] Compliance gap highlighting in editor (real-time or on-save) — enhances the existing compliance matrix and editor
- [ ] Small business set-aside cert matching notifications — low complexity, meaningful signal for the HCC target market

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] Multi-user team collaboration — adds significant auth/permissions complexity; validate solo workflow first
- [ ] Version history with diff view — useful but not mission-critical for solo users
- [ ] GovRFP deep-link integration — requires coordination between two products; deliver after both are stable
- [ ] Template library (agency-specific formats) — valuable but requires curation effort; defer until usage patterns reveal which agencies users bid on most

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| RFP upload (PDF/DOCX) | HIGH | LOW | P1 |
| AI requirement extraction | HIGH | MEDIUM | P1 |
| Compliance matrix generation | HIGH | MEDIUM | P1 |
| Contractor profile | HIGH | MEDIUM | P1 |
| AI proposal drafting (all sections) | HIGH | HIGH | P1 |
| Section regeneration with instructions | HIGH | LOW | P1 |
| Rich text editor with auto-save | HIGH | MEDIUM | P1 |
| RFP sidebar | MEDIUM | LOW | P1 |
| Compliance matrix linked to editor | HIGH | MEDIUM | P1 |
| Win probability score with reasoning | HIGH | MEDIUM | P1 |
| Export to Word (.docx) | HIGH | MEDIUM | P1 |
| Export to PDF | MEDIUM | LOW | P1 |
| Auth + document storage | HIGH | LOW | P1 |
| Stripe billing | HIGH | LOW | P1 |
| Section L/M crosswalk table | HIGH | MEDIUM | P2 |
| Past performance auto-narrative | HIGH | MEDIUM | P2 |
| Real-time compliance gap highlighting | MEDIUM | MEDIUM | P2 |
| Set-aside cert matching | MEDIUM | LOW | P2 |
| Multi-user collaboration | MEDIUM | HIGH | P3 |
| Version history | LOW | MEDIUM | P3 |
| GovRFP integration | MEDIUM | MEDIUM | P3 |
| Agency-specific template library | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Loopio / Responsive (RFPIO) | GovDash | AutogenAI Federal | Unanet ProposalAI | HCC ProposalAI (our approach) |
|---------|----------------------------|---------|-------------------|-------------------|-------------------------------|
| Target market | Enterprise sales/BD teams | Government contractors (all sizes) | Enterprise GovCon | AEC + GovCon firms | Small/mid-size contractors; HCC community |
| AI drafting | Yes — content library + AI fill | Yes — compliance-first drafting | Yes — 5-min first draft, 70% faster | Yes — 70% faster, knowledge library | Yes — Claude API; long context handles full RFPs |
| Compliance matrix | Basic | Yes — Section L/M aware | Yes — multi-document "shredding" | Yes — requirement-to-response mapping | Yes — Section L/M separation, mandatory/desired flagging |
| Win probability score | No (enterprise-level products don't surface pWin) | Yes — bid/no-bid support | Not prominently featured | Not mentioned | Yes — 4-5 factor reasoning breakdown; key differentiator for solo contractors |
| Contractor profile with certifications | No (content library, not contractor profile) | Partial — opportunity matching | No — enterprise knowledge base | No — past proposal library | Yes — 8(a), HUBZone, SDVOSB, WOSB, NAICS, past projects, personnel bios |
| In-browser editor | Yes — portal-based editing | Yes | Yes | Yes | Yes — TipTap/Lexical; compliance matrix live-linked |
| Export (Word/PDF) | Yes | Yes | Yes | Yes | Yes |
| RFP upload (any format) | Yes — portal import + file upload | Yes | Yes — multi-document | Yes | Yes — PDF + DOCX |
| Solo/small business pricing | No — enterprise pricing ($30K+/year) | Not published; enterprise-oriented | Enterprise contracts | Not published | Per-seat/month (Stripe); accessible to solo contractors |
| Federal compliance focus (FAR, etc.) | Limited — general RFP tools | Yes — GovCon-specific | Yes — FedRAMP, CMMC, CUI | Yes | Yes — FAR Part 15, set-aside parsing |
| Multi-user collaboration | Yes — core feature | Yes | Yes | Yes | Not in MVP |

**Key insight:** The enterprise tools (Loopio, Responsive) are built for large BD teams with content libraries. The GovCon-specific tools (GovDash, AutogenAI, Unanet) are increasingly feature-rich but priced and positioned for mid-to-large contractors. The gap HCC ProposalAI fills is: GovCon-aware AI drafting at solo/small-business pricing, with a contractor profile schema tuned to small business certifications.

---

## Sources

- Arphie.ai: "Top 30 RFP Proposal Software in 2026" — standard vs. differentiating features analysis
- AutogenAI Federal announcement — requirement shredding, FedRAMP, 5-minute first draft claims
- GovEagle blog: "AI Proposal Writing Tools for Government Contractors" — GovDash and Procurement Sciences features
- Inventive.ai: "Comparison of Government AI RFP Response Software" — 7-tool feature matrix
- AutoRFP.ai: "Loopio vs Responsive 2026 Review" — feature comparison of legacy platforms
- CLEATUS blog: "How to Calculate PWin" — pWin score methodology and automation patterns
- Procurement Sciences: "Pwin: The Complete Guide" — pWin factors (scope alignment, past performance, certifications, competition)
- HSVAGI: "RFP Response Automation: Compliance Matrix Requirements" — Section L/M separation, 97% accuracy claim for AI parsing
- Unanet ProposalAI — knowledge library injection, AWS GovCloud deployment model
- Arphie.ai blog: "Loopio vs Responsive: Comparing Legacy RFP Software Tools"
- GovCon community data: 25+ hours for manual requirement extraction; 15+ hours for shredding; 8+ hours for first draft
- AutogenAI: "30% increase in win rates" claim (MEDIUM confidence — single-source vendor claim)

---

*Feature research for: AI-assisted RFP/Government Proposal Writing SaaS*
*Researched: 2026-03-23*
