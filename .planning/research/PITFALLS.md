# Pitfalls Research

**Domain:** AI-assisted document analysis + proposal generation SaaS (government contracting)
**Researched:** 2026-03-23
**Confidence:** HIGH — all major findings verified against official documentation or multiple independent sources

---

## Critical Pitfalls

### Pitfall 1: PDF Parsing Reliability — Garbled Text, Lost Tables, Image-Only Documents

**What goes wrong:**
Government RFPs arrive in multiple PDF flavors: text-based (clean extraction), scanned (image-only, requires OCR), and hybrid (mixed pages). A naive `pdf-parse` or `pdf2json` approach extracts text-based pages fine, then silently produces garbage or empty strings on scanned pages. Tables across multiple columns collapse into a linear stream of words, losing all row/column relationships. Multi-column layouts merge adjacent columns into a single text flow. Headers formatted with custom fonts may render as Unicode replacement characters. The system appears to work on test PDFs but fails on real government documents, which frequently are scanned legacy forms.

**Why it happens:**
Developers test with clean PDFs from their own computer. Government agencies often scan existing printed solicitations and publish as image PDFs. The parser returns empty strings (not errors) for image pages, so there is no exception to catch — the compliance matrix just silently misses requirements.

**How to avoid:**
- Use a pipeline that detects PDF type first: run `pdfinfo` or check if extracted text is under a threshold (e.g., fewer than 100 characters per page) to flag as likely scanned.
- For image PDFs, route through an OCR step — Tesseract via `tesseract.js` for in-process, or a managed service like AWS Textract or Google Document AI for higher accuracy.
- For table extraction specifically, do not rely on text-stream parsers. Use a library with structural awareness: `Docling` (Python, open source) has shown 100% text fidelity in benchmarks; for Node.js, use `pdf-lib` for structure + LLM-assisted table reconstruction.
- After extraction, validate output quality: check character count, check for presence of section headers, and surface a "low confidence parse" warning to the user rather than proceeding silently.
- Store the raw extracted text per page so manual inspection is possible during debugging.

**Warning signs:**
- Compliance matrix returns fewer than 10 requirements for a 60-page solicitation
- Win probability score reasoning cites no specific RFP sections
- User reports "the AI missed [requirement]" and that requirement was in a table
- Extracted text contains runs of `â€™` or similar mojibake

**Phase to address:** Document Ingestion phase (earliest possible — this is the foundation everything else rests on)

---

### Pitfall 2: Claude API Cost Blowout from Uncontrolled Token Usage

**What goes wrong:**
A full government RFP PDF easily runs 50–150 pages. Extracted text can be 80,000–200,000 tokens. Sending the full document as context on every API call — for section drafting, compliance matrix generation, win scoring, and re-generation — multiplies cost per proposal by 5–10x. At Sonnet 4.6 pricing ($3/MTok input, $15/MTok output), a 150k-token input sent 6 times equals $2.70 in input tokens alone, before output. At 100 proposals per month with 10 users, that is $2,700/month in AI costs — which wipes out a $299/month SaaS product at 9 users.

**Why it happens:**
Developers prototype with small test PDFs and don't project at scale. The first working demo sends the full document every time. Prompt caching is an afterthought. There is no per-request budget tracking.

**How to avoid:**
- Use Anthropic prompt caching: set `cache_control` on the RFP document block. A cache hit costs 0.10x the input price ($0.30/MTok vs $3/MTok). For a 150k-token RFP sent 6 times, caching reduces input cost from $2.70 to ~$0.59 — an 78% reduction.
- Design the pipeline so the RFP document is the stable/cached block and only the task instruction changes per call.
- Use Claude Haiku 4.5 ($1/MTok input, $5/MTok output) for low-stakes tasks: initial requirement extraction, section identification, win factor scoring. Reserve Sonnet/Opus only for final drafting.
- Implement a per-user monthly token budget enforced server-side. Surface a usage indicator to users ("3 of 5 AI generations used this month").
- Track costs per proposal in the database — `ai_cost_cents` column on the proposals table — so you know your actual margins before scaling.
- Use the Batch API (50% discount) for non-interactive tasks like initial compliance matrix generation that don't need real-time response.

**Warning signs:**
- API cost exceeds $50/user/month at normal usage levels
- A single "regenerate all sections" button triggers 6+ sequential full-document API calls
- No `cache_control` blocks present in API request code
- No per-user usage tracking in the database

**Phase to address:** Document Ingestion + AI Drafting phases — architecture decision must be made before the first API call is written

---

### Pitfall 3: Compliance Matrix Hallucination — Invented Requirements, False Coverage Claims

**What goes wrong:**
Claude generates a compliance matrix listing requirements that do not appear in the RFP, or marks requirements as "addressed" in the draft when they are not. Fabricated requirements look plausible — they follow government solicitation patterns — so reviewers may not catch them. False "addressed" markers in a real proposal submission constitute a compliance lie that can disqualify a bid or create legal exposure for HCC members.

**Why it happens:**
LLMs pattern-match on training data. When asked "list all requirements from this RFP," the model may generate requirements it expects to see in a typical RFP rather than only requirements present in the provided text. When asked "does section 3 address requirement X," it may answer "yes" because the section discusses related topics rather than strictly verifying the requirement is met.

**How to avoid:**
- Use a strict grounding prompt for requirement extraction: "List ONLY requirements explicitly stated in the document below. Do not infer, extrapolate, or add requirements you would expect to see. For each requirement, include the exact page number and section heading where it appears."
- For every compliance check (is requirement X addressed?), require Claude to quote the verbatim passage from the draft that addresses the requirement. If it cannot quote a passage, it must mark the requirement as NOT addressed.
- Use structured outputs with the `bespoke-minicheck` pattern: first extract requirements, then verify each independently with a narrow focused prompt, rather than asking Claude to do both in one call.
- Display source citations in the UI: every compliance matrix row shows the page/section the requirement was extracted from. Users can click to verify.
- Add a prominent disclaimer: "AI-generated compliance matrix requires human review before submission." Frame the tool as acceleration, not replacement.

**Warning signs:**
- Compliance matrix for a 40-page RFP returns 80+ requirements (likely hallucinating)
- Requirements appear that reference agencies, forms, or regulations not mentioned in the uploaded document
- "Addressed" checkmarks appear immediately on first draft generation before any editing has occurred

**Phase to address:** Compliance Matrix phase — must be designed defensively from the start, not patched later

---

### Pitfall 4: Rich Text Editor Complexity Underestimated

**What goes wrong:**
Teams prototype with a `<textarea>` or simple `contentEditable` div and ship Tiptap/ProseMirror assuming the migration is a configuration task. In production: pasting from Word brings in unwanted HTML/styles, undo history grows unbounded and causes memory leaks, cursor position resets after AI content injection, React re-renders on every keystroke trigger full editor re-mount, and the editor state diverges from the source-of-truth data model (the generated proposal sections stored in Supabase). The AI "insert at cursor" feature breaks when the cursor is inside a formatted block.

**Why it happens:**
ProseMirror is powerful but its schema, transactions, and plugin system have a steep learning curve. Developers underestimate the integration work between the editor state and the rest of the React application. The AI content injection pattern (receiving a streaming response and inserting text) requires understanding of ProseMirror transactions.

**How to avoid:**
- Commit to Tiptap from day one — do not build with a simpler editor with intent to migrate. Migration costs are high.
- Use Tiptap's `setContent` and `insertContentAt` commands for AI-generated content rather than direct DOM manipulation.
- Configure `editorProps.transformPastedHTML` to sanitize pasted content to the permitted schema on paste.
- Store the editor content as Tiptap JSON (not HTML) in Supabase. HTML serialization introduces formatting drift; JSON is the canonical format.
- Use `useEditor` with `shouldRerenderOnTransaction: false` to prevent React re-renders on every keystroke.
- Test AI streaming insertion early — this is the hardest integration. Use a fake streaming source in tests before wiring to the real Claude API.
- Implement auto-save using `editor.on('update', debounce(save, 1000))` from day one, not as an afterthought.

**Warning signs:**
- Editor re-mounts visibly on every AI generation
- Undo history does not include AI-generated content (content was injected bypassing the transaction system)
- Pasted government boilerplate introduces styles that persist through the export

**Phase to address:** Rich Text Editor phase — foundation decisions must be correct before AI drafting integration

---

### Pitfall 5: Word/PDF Export Fidelity Gap

**What goes wrong:**
The exported `.docx` or `.pdf` looks different from what the user saw in the editor. Common failures: heading levels flatten (H1/H2/H3 all render as the same style), numbered lists restart at 1 after each section, bold/italic inside a table cell is stripped, margins differ from the solicitation's required formatting, and the contractor logo does not appear in the header. The PDF export looks fine on macOS but has font substitution issues on Windows. Users submit the exported document and evaluators see unprofessional formatting.

**Why it happens:**
Tiptap exports HTML; the `docx` npm library has a different model. The mapping between HTML elements and docx constructs is not 1:1. The `html-docx-js` shortcut libraries do a lossy conversion. PDF generation via headless Chromium (Puppeteer) depends on system fonts that differ across deployment environments.

**How to avoid:**
- Use the `docx` npm library (v9+) directly, not `html-docx-js`. Build a typed Tiptap-JSON-to-docx converter that maps each node type to a specific docx construct. This is more work upfront but gives exact control over formatting.
- Define a "proposal document template" as a `docx` styles document with named styles (Heading1, Body, TableContent, etc.) and map editor nodes to those named styles — this makes the output match a government-standard look.
- For PDF, use `@react-pdf/renderer` to build a typed React-to-PDF pipeline rather than Puppeteer screenshot. This avoids environment font issues and produces reliable output.
- Build a visual regression test for export: generate a test proposal, export to docx, open with `mammoth` and compare the HTML output to a golden file.
- Test exports on both Word Online and desktop Word — they render differently on edge cases.

**Warning signs:**
- "Looks good on screen but the download is broken" user feedback
- Heading levels in exported file are all the same font size
- Lists are unordered in docx when they were ordered in the editor

**Phase to address:** Export phase — but document the schema mapping in the editor phase so the data model supports it

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Send full RFP text on every API call (no caching) | Simpler first implementation | 78% cost overpay at scale, margin destruction | Never — implement caching from first API call |
| Use `html-docx-js` for Word export | Ships in hours | Lossy conversion, formatting complaints, hard to fix | MVP only if you have a "known limitations" warning; replace before GA |
| Store editor content as HTML in Supabase | Familiar format | Formatting drift, lossy round-trips, hard to diff | Never — use Tiptap JSON from day one |
| Text-only PDF extraction (no OCR fallback) | Simpler pipeline | Silent failures on scanned RFPs, phantom compliance matrices | Never for a government doc tool |
| Stripe webhook processing inline (synchronous) | Less infrastructure | Missed events, timeouts, duplicate processing | Never — always queue async from day one |
| Polling Stripe API for subscription status | Avoids webhook complexity | Rate limits, stale state, access granted when it shouldn't be | Never — webhooks are the only reliable source of truth |
| Single Claude call for "extract + draft + score" | Fewer API calls | Uncontrollable output, schema violations, impossible to retry one step | Never — separate concerns into discrete pipeline steps |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API — document ingestion | Sending entire PDF text as a single `user` message | Place the RFP text in a `cache_control` system block; task instructions go in `user` |
| Claude API — structured output | Using complex nested schemas with `anyOf`/`oneOf` | Flatten schemas; one required level of nesting max; use `additionalProperties: false` always |
| Claude API — compliance extraction | Asking "list all requirements" in one pass | Two-pass: (1) extract section headings and page ranges, (2) extract requirements per section |
| Supabase Storage — file upload | Using `anon` key in client component for direct upload | Use signed upload URLs generated server-side; never expose `service_role` key to client |
| Supabase Storage — RLS | Creating bucket without RLS policies, relying on private bucket as security | Write explicit `INSERT`/`SELECT` policies on `storage.objects` scoped to `auth.uid()` path prefix |
| Supabase Storage — file listing | Using `storage.list()` on a bucket with thousands of objects | Query `storage.objects` table directly via Postgres function for performance |
| Stripe — webhook processing | Returning 200 after completing all work synchronously | Return 200 immediately; process in background job/queue; use event ID for idempotency |
| Stripe — subscription state | Deriving access from your own DB state | Always re-derive access from Stripe subscription status via webhook; DB is a cache, Stripe is truth |
| Stripe — trial end | Not handling `customer.subscription.updated` when trial converts | Explicitly watch `trialing → active` transition to confirm payment method exists |
| Stripe — upgrade/downgrade | Not setting `proration_behavior` explicitly | Always set `proration_behavior: 'create_prorations'` and document the proration behavior in UI copy |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full RFP re-sent on every regeneration | High API latency (30-60s), high cost per session | Prompt caching; separate document from task instruction | First paying customer at normal usage |
| Synchronous AI generation in API route | 30-60s HTTP timeouts, Vercel function limit (60s default) | Stream responses via SSE; use Vercel Edge or background queue for full-document generation | First RFP over 50 pages |
| All AI pipeline steps sequential | User waits 3-5 minutes for initial draft | Parallelize independent steps: compliance extraction and section drafting can run concurrently | Every user, every time |
| PDF text stored in Supabase column (not storage) | Database bloat, slow queries on proposals table | Store extracted text as `.txt` file in Supabase Storage; store metadata/status in DB | ~500 proposals in DB |
| Editor content stored as HTML blob | Formatting drift, export failures, large payloads | Store as Tiptap JSON; HTML is a render concern, not a storage concern | Every export, every round-trip |
| Supabase Storage listing with `storage.list()` | Slow folder browsing at >1000 objects | Direct Postgres query on `storage.objects` table | ~1000 files per account |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `SUPABASE_SERVICE_ROLE_KEY` in client-side code | Full database bypass — any user can read/modify any row | Service role key is server-only; clients get anon key + authenticated JWT only |
| Public Supabase Storage bucket for RFP documents | Competitors, bad actors access contractor proposal documents | Private bucket with signed URLs; RLS policies scoped to `auth.uid()` path prefix |
| Returning Claude API response directly to client without sanitization | Prompt injection: malicious RFP content could instruct Claude to exfiltrate other data | Validate structured output schema server-side; never relay raw Claude text to untrusted display |
| Storing contractor profile data (certifications, win strategies) without encryption | Data breach exposes competitive intelligence — HCC member liability | Encrypt sensitive fields at application layer before storage; not just Supabase RLS |
| Not validating Stripe webhook signature | Replay attacks, fraudulent subscription events granting free access | Always verify `stripe.webhooks.constructEvent(body, sig, secret)` before processing |
| AI-generated proposal content logged to persistent store | Contractor proposal strategies stored by AI provider | Use Anthropic's zero-retention settings for API calls; document in privacy policy |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress feedback during 30-60s AI generation | User refreshes page, loses state, triggers duplicate API call | Stream partial output to UI immediately; show section-by-section progress |
| AI overwrites user edits on regeneration | Contractors lose hours of editing work | Section-level regeneration only; require explicit confirmation before overwriting edited content; "AI draft is locked after manual edit" |
| Compliance matrix not linked to editor sections | User must manually track which requirements their edits address | Highlight editor paragraphs that reference a selected compliance item; live link on scroll |
| Generic "AI failed" error message | User doesn't know if it's a parse failure, token limit, or billing issue | Surface specific error types: "Document too large," "Parse quality low — try a different PDF format," "Monthly AI limit reached" |
| No visible parse quality indicator | User trusts a compliance matrix built on garbage OCR output | Show a "Document parse quality: Good / Fair / Poor" badge on every proposal, based on character density and section detection metrics |
| Export with no filename convention | Contractors download "proposal.docx" to their desktop, can't find it later | Auto-filename as `[contractor-name]-[solicitation-number]-[date].docx` |

---

## "Looks Done But Isn't" Checklist

- [ ] **PDF ingestion:** Verify against a scanned (image-only) government RFP — not just a born-digital PDF from your test set
- [ ] **Compliance matrix:** Confirm every row has a source citation (page + section); no row should appear without a traceable origin
- [ ] **AI cost tracking:** Verify that `ai_cost_cents` is recorded per proposal before enabling billing; do not go live blind on margins
- [ ] **Prompt caching:** Confirm `cache_control` blocks appear in actual API requests (check via Anthropic console usage page for cache hit rates)
- [ ] **Stripe webhook idempotency:** Verify that sending the same `invoice.payment_succeeded` event twice does not grant access twice or charge the user twice
- [ ] **Stripe trial end:** Test the `trialing → active` transition with a Stripe Test Clock in sandbox — not manually with real time
- [ ] **Supabase RLS on storage:** Attempt to access another user's uploaded RFP file while authenticated as a different user — access must be denied with 403
- [ ] **Export fidelity:** Export to `.docx`, open in Microsoft Word on Windows, confirm heading hierarchy and list numbering are preserved
- [ ] **Editor auto-save:** Kill the browser tab mid-edit and reopen — verify no edits were lost
- [ ] **Streaming timeout:** Trigger a 150k-token generation and confirm the response streams successfully without hitting Vercel's 60s function timeout

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PDF parsing failure discovered in production | MEDIUM | Add OCR fallback path; re-process affected proposals with improved pipeline; offer "re-parse" button in UI |
| Cost blowout before caching implemented | HIGH | Implement prompt caching immediately (days of work); add per-user monthly caps with hard cutoff; may need emergency price increase |
| Compliance matrix hallucinations reported | HIGH | Redesign extraction prompts with grounding requirement; add citation requirement to all claims; add human review disclaimer; audit all existing matrices |
| Stripe webhook race condition causing wrong access state | MEDIUM | Add idempotency key table; replay missed events from Stripe dashboard; add reconciliation job that compares DB state to Stripe every hour |
| Editor content corrupted (HTML stored instead of JSON) | HIGH | Write migration script to convert stored HTML to Tiptap JSON; lossy conversion acceptable if user re-edits; requires regression testing all proposals |
| Word export formatting regression | LOW | Roll back `docx` library version; fix mapping in next sprint; offer "download as PDF" as fallback while fixing |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PDF parsing reliability (garbled text, OCR gaps) | Document Ingestion | Parse 5 real government RFPs including at least 2 scanned; verify requirement count matches human review |
| Claude API cost blowout | Document Ingestion (architecture) + AI Drafting | Confirm `cache_control` blocks in code review; log cost per proposal to DB; verify cache hit rate >80% in Anthropic console |
| Compliance matrix hallucination | Compliance Matrix phase | Test with a known RFP where you manually counted requirements; verify AI count matches; verify all rows have citations |
| Rich text editor complexity (paste, undo, AI injection) | Rich Text Editor phase | Paste a Word document; confirm unwanted styles stripped; undo through 10 actions; inject AI content mid-document |
| Word/PDF export fidelity | Export phase | Export test proposal; open in Word on Windows and macOS; verify heading levels, list numbering, table formatting |
| Supabase Storage RLS misconfiguration | Accounts & Billing + Ingestion | Cross-user access test: User A cannot download User B's file |
| Stripe webhook idempotency and state sync | Accounts & Billing phase | Replay test webhooks; verify idempotency table prevents double-processing |
| Stripe trial/upgrade/cancellation edge cases | Accounts & Billing phase | Use Stripe Test Clocks to simulate trial end, upgrade, and cancellation in sequence |
| AI proposal "AI speak" — generic output | AI Drafting phase | Contractor profile data must appear verbatim in draft output; run test with real HCC member profile |
| Streaming timeout on large documents | AI Drafting phase | Time full-document generation on 150k-token RFP; confirm no timeout under Vercel Edge runtime |

---

## Sources

- [Anthropic Claude API Pricing — official](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Structured Outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [PDF Data Extraction Benchmark 2025 — Procycons](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/)
- [State of PDF Parsing — Applied AI](https://www.applied-ai.com/briefings/pdf-parsing-benchmark/)
- [Benchmarking PDF Parsers on Table Extraction — arXiv 2025](https://arxiv.org/html/2603.18652v1)
- [Four AI Risks in Proposal Writing — Lohfeld Consulting 2025](https://lohfeldconsulting.com/blog/2025/12/how-to-overcome-four-ai-risks-in-proposal-writing-now/)
- [AI Hallucination Risks in Proposal Writing — AutogenAI](https://autogenai.com/blog/ai-hallucination-how-can-proposal-teams-reduce-risk/)
- [Stripe webhook best practices — Stigg](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Stripe subscription pitfalls — BuildVoyage](https://buildvoyage.com/articles/stripe-laravel-subscriptions-pitfalls-and-fixes)
- [Stripe using webhooks with subscriptions — official docs](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Supabase Storage access control — official docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Storage file limits — official docs](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase RLS performance best practices — official docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Which rich text editor framework in 2025 — Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Tiptap ProseMirror docs](https://tiptap.dev/docs/editor/core-concepts/prosemirror)

---
*Pitfalls research for: AI-assisted RFP proposal generation SaaS (HCC ProposalAI)*
*Researched: 2026-03-23*
