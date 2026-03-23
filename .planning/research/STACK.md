# Stack Research

**Domain:** AI-assisted RFP proposal writing SaaS
**Researched:** 2026-03-23
**Confidence:** HIGH (most layers verified against official docs or npm registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (stable) | Full-stack React framework | App Router is stable and production-ready in 15. New projects should not start on 14 — 15 is what Vercel ships on internally. Caching defaults changed (no implicit fetch caching), which is actually more correct for a SaaS with per-user data. Turbopack in dev is 5-10x faster HMR. |
| React | 19.x | UI runtime | Required peer dep for Next.js 15. React Server Components + Server Actions are the correct primitives for AI streaming and form handling. |
| TypeScript | 5.x | Type safety | Not optional for a product this complex — compliance matrix data structures, proposal sections, and Stripe webhook payloads all benefit from strict typing. |
| Supabase | Cloud (JS SDK v2.99+) | Database, auth, file storage, RLS | Eliminates need for a separate auth service, separate file storage, and a separate database host. Row Level Security (RLS) policies handle per-user data isolation without application-layer filtering. Matches the existing GovRFP stack investment. |
| Claude API | claude-sonnet-4-6 / claude-opus-4-6 | RFP parsing, compliance matrix, proposal drafting | Only option per project constraints. Sonnet 4 is the correct default: faster and cheaper than Opus 4 with sufficient quality for structured extraction and proposal generation. Use Opus 4 only for the win probability analysis where reasoning depth matters most. |
| Stripe | stripe@17.x (Node SDK) + @stripe/stripe-js@5.x | Subscription billing | Industry standard for SaaS subscriptions. Handles SCA, retries, invoices, and tax automatically via Checkout. Per-seat model maps to Stripe's standard recurring Price + subscription model. |
| Tiptap | @tiptap/core 2.x / 3.x | Rich text editor | ProseMirror-based, headless, React-native. Best DX for a custom editor that needs to live-link to the compliance matrix. Lexical is faster but Tiptap has better extension ecosystem and documentation. Quill is obsolete. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | 0.x (latest) | Supabase auth in Next.js App Router with SSR | Always — replaces deprecated `@supabase/auth-helpers-nextjs`. Handles cookie-based session storage correctly for both Server Components and Client Components. |
| @anthropic-ai/sdk | 0.80.x | Anthropic TypeScript SDK | Server-side only (API routes / Server Actions). Never import in client components — exposes API key. |
| mammoth | 1.x | Convert uploaded .docx to HTML/plain text for Claude ingestion | Use when user uploads a Word RFP. Extracts clean text from DOCX without requiring LibreOffice or server-side binary dependencies. |
| pdf-parse | 1.1.x | Extract text from uploaded PDFs for Claude ingestion | Use when user uploads a PDF RFP. Lightweight, Node.js only. For complex PDFs with charts, fall through to Claude's native PDF vision via Files API instead. |
| docx | 9.6.x | Generate .docx export of finished proposals | Server-side only. Programmatic Word document generation with styles, headings, tables. Actively maintained (published 13 days ago as of research date). |
| @react-pdf/renderer | 4.x | Generate PDF export of finished proposals | Serverless-compatible (no Chromium binary required). Renders PDF from React components. Use for PDF export; do NOT use Puppeteer on Vercel — binary size exceeds serverless limits. |
| zod | 3.x | Runtime validation of AI-extracted JSON, Stripe webhooks, form inputs | Validate everything Claude returns as structured data. Also use for webhook signature + payload validation. |
| @tanstack/react-query | 5.x | Client-side async state management | Use for polling proposal generation status, optimistic updates during editing, and caching proposal list. Pairs well with Next.js App Router (server components for initial load, React Query for client interactions). |
| react-dropzone | 14.x | File upload UI (drag-and-drop RFP upload) | Integrates cleanly with Supabase Storage upload. Handles file type filtering (PDF/DOCX only) client-side before upload. |
| stripe (webhook) | stripe@17.x | Server-side webhook handler | Use in a dedicated API route (`/api/webhooks/stripe`). Listen to `customer.subscription.created`, `invoice.paid`, `customer.subscription.deleted` — not just checkout. Missing `invoice.paid` means users lose access after first renewal. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local Supabase instance, migrations, type generation | Run `supabase gen types typescript` after every migration to keep DB types in sync. Critical for RLS policy testing locally before pushing. |
| Stripe CLI | Local webhook forwarding | Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in dev. Do not test billing flows without this — webhook signature verification will fail. |
| eslint + @typescript-eslint | Code quality | Include `@typescript-eslint/no-explicit-any` — the AI response parsing code will tempt you to use `any` everywhere. Don't. |
| Playwright | E2E testing | Essential for testing the proposal editor flow end-to-end. Tiptap is notoriously hard to unit test; browser-level tests are the only reliable option. |

---

## Installation

```bash
# Bootstrap
npx create-next-app@latest hcc-proposal-ai --typescript --tailwind --app --src-dir

# Core Supabase
npm install @supabase/supabase-js @supabase/ssr

# AI
npm install @anthropic-ai/sdk

# Editor
npm install @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count

# Document parsing (server-side only)
npm install mammoth pdf-parse

# Document export (server-side only)
npm install docx @react-pdf/renderer

# Billing
npm install stripe @stripe/stripe-js

# Validation + state
npm install zod @tanstack/react-query

# File upload UI
npm install react-dropzone

# Dev tools
npm install -D supabase stripe @playwright/test
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15 | Next.js 14 | Never for a new project in 2026. 14 is in maintenance; 15 is stable with better defaults. |
| Tiptap | Lexical | If you need raw performance with very large documents (10k+ word proposals). Lexical has lower memory usage. Tradeoff: worse docs, fewer ready-made extensions, steeper custom extension curve. |
| Tiptap | Quill | Never. Quill 2.x development stalled; the ecosystem has moved on. Tiptap has superceded it for production use. |
| @react-pdf/renderer | Puppeteer | If deploying to a long-running server (not Vercel/serverless) and need pixel-perfect HTML-to-PDF fidelity. Puppeteer exceeds Vercel function size limits. |
| docx (npm) | docxtemplater | If you need template-based Word output (fill in placeholders in a .docx template). `docx` is better for programmatic generation from structured data, which is what this app produces. |
| mammoth | officeParser | If you also need PPTX/XLSX parsing. mammoth is simpler and more reliable for DOCX-only use case. |
| Supabase Storage | AWS S3 | If the team already has deep AWS infrastructure expertise and needs fine-grained IAM policies. Supabase Storage is S3-compatible under the hood; migrating later is low risk. |
| Claude API (Anthropic native) | Vercel AI SDK with Anthropic provider | If you plan to add multi-provider AI support later. For a Claude-only product (per project constraint), the native `@anthropic-ai/sdk` is simpler and avoids an abstraction layer. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer on Vercel | Chromium binary exceeds serverless function size limit (50MB max). Deployment will fail. | `@react-pdf/renderer` for PDF export. If Puppeteer is truly required, deploy a dedicated PDF microservice separately. |
| `@supabase/auth-helpers-nextjs` | Deprecated. Bug fixes and new features are only going to `@supabase/ssr`. Auth will break with future Next.js updates. | `@supabase/ssr` |
| Quill | Development is stagnant; no active maintenance. Lacks React 19 compatibility. | Tiptap |
| Pages Router in Next.js | Entering maintenance mode per Vercel. No new features. App Router is the current standard. | App Router (Next.js 15) |
| OpenAI API | Violates project constraint (Claude API only). Claude's 200k context window handles full RFPs without chunking that OpenAI's smaller windows require. | `@anthropic-ai/sdk` |
| `@supabase/auth-helpers-shared` | Same deprecation issue as auth-helpers-nextjs. | `@supabase/ssr` |
| pdf-lib | Good for PDF manipulation (adding pages, modifying existing PDFs), not extraction. Wrong tool for parsing RFP text. | `pdf-parse` for text extraction; Claude Files API for visual analysis. |
| react-quill | React wrapper for the stagnant Quill library. Same problems. | Tiptap with `@tiptap/react` |

---

## Stack Patterns by Variant

**For RFP PDF upload and text extraction:**
- Upload to Supabase Storage first (signed URL upload from client)
- For text-extractable PDFs: run `pdf-parse` server-side to get raw text, then send text to Claude
- For image-heavy/scan PDFs: use Claude's native Files API (`anthropic-beta: files-api-2025-04-14`) — upload the PDF as a file_id and send to Claude with the document block. Claude processes each page as an image.
- Do not try to pre-parse scan PDFs with pdf-parse — it returns garbage on image-only PDFs.

**For Word (.docx) RFP upload:**
- Upload to Supabase Storage
- Run `mammoth` server-side to convert DOCX to HTML/plain text
- Send extracted text to Claude (do not send binary DOCX directly to Claude API)

**For proposal export:**
- Word export: generate server-side with `docx` npm package in an API route. Return as a downloadable blob.
- PDF export: generate server-side with `@react-pdf/renderer` in an API route. Define a `ProposalDocument` component that maps proposal sections to PDF layout. Return as a blob.

**For streaming AI responses:**
- Use Claude's streaming API (`stream: true`) via Server Actions or route handlers
- Pipe to the client using `ReadableStream` and consume with `useEffect` + `EventSource` or Vercel's `StreamingTextResponse` pattern
- Do not buffer entire AI responses — proposals can be 3k-8k tokens and users should see words appearing

**For subscription gating:**
- Store `stripe_customer_id` and `subscription_status` on the Supabase `profiles` table
- Update via Stripe webhook (not on checkout redirect — redirect can be missed)
- Check subscription status in Next.js middleware before serving protected routes

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15 | React 19 | React 19 is required peer dep. React 18 works but you lose concurrent features. |
| @supabase/supabase-js 2.99+ | Node.js 20+ | Node.js 18 support dropped in v2.79. Use Node 20 or 22. |
| @tiptap/core 2.x / 3.x | React 18 + 19 | Both versions support React 19. Stick to v2 for now — v3 is in active development and API surface is less stable. |
| @react-pdf/renderer 4.x | React 19 | v4 has React 19 support. Earlier versions had issues with React 18+ hooks. |
| docx 9.x | Node 18+ | Works in API routes. Do not import in client components — it's Node.js only. |
| mammoth 1.x | Node 18+ | Server-only. Not browser-compatible without significant bundling effort. |
| pdf-parse 1.x | Node 18+ | Server-only. Has a known issue with test files on import; only import inside the function that uses it, not at the top of a module. |
| stripe (server SDK) 17.x | Node 20+ | Use the `stripe` package server-side only. Use `@stripe/stripe-js` client-side for Stripe.js/Elements. |

---

## Claude API Model Selection Guide

| Task | Recommended Model | Rationale |
|------|------------------|-----------|
| RFP parsing (extract requirements, deadlines, criteria) | claude-sonnet-4-6 | Structured extraction at scale. Cheaper than Opus. Fast enough for a progress bar UX. |
| Compliance matrix generation | claude-sonnet-4-6 | Pattern matching against extracted requirements. No deep reasoning required. |
| Proposal section drafting (all sections) | claude-sonnet-4-6 | High-quality prose generation. Sonnet 4 produces proposal-quality writing. |
| Win probability score + reasoning breakdown | claude-opus-4-6 | This is the differentiator feature. The reasoning quality from Opus justifies the cost premium. One call per proposal, not per section. |
| Section regeneration with custom instructions | claude-sonnet-4-6 | Conversational refinement. Speed matters here (user is waiting interactively). |

Use prompt caching (`cache_control: { type: "ephemeral" }`) on the uploaded RFP document block for all subsequent calls in the same session. At 1,500-3,000 tokens per page for a 50-page RFP, caching saves significant cost on the compliance matrix + drafting sequence.

---

## Sources

- [Next.js 15 official release notes](https://nextjs.org/blog/next-15) — version and caching behavior changes confirmed
- [Anthropic PDF Support docs](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) — PDF limits (600 pages, 32MB), Files API pattern, prompt caching verified
- [Anthropic Files API docs](https://platform.claude.com/docs/en/build-with-claude/files) — 500MB per file limit, beta header requirement confirmed
- [@supabase/ssr npm](https://www.npmjs.com/package/@supabase/ssr) — deprecation of auth-helpers confirmed via official migration docs
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.3 current version confirmed
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.80.0 current version confirmed
- [docx npm](https://www.npmjs.com/package/docx) — v9.6.1 current version confirmed (actively maintained)
- [@tiptap/pm npm](https://www.npmjs.com/package/@tiptap/pm) — v3.14.0 latest, Tiptap v2/v3 status confirmed
- [Liveblocks: Which rich text editor 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) — Tiptap vs Lexical comparison (MEDIUM confidence, single source)
- [Stripe + Next.js 15 guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — Server Actions pattern, webhook event requirements (MEDIUM confidence)
- Puppeteer on Vercel serverless size limit — multiple sources confirm (MEDIUM confidence, community consensus)

---

*Stack research for: AI-assisted RFP proposal writing SaaS (HCC ProposalAI)*
*Researched: 2026-03-23*
