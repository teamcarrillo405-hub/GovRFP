# Architecture Research

**Domain:** AI-assisted document processing + proposal generation SaaS
**Researched:** 2026-03-23
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js RSC + Client)            │
├──────────────────┬───────────────────────┬───────────────────────┤
│  Upload UI       │  Rich Text Editor     │  Compliance Matrix UI │
│  (drag/drop)     │  (Tiptap)             │  (live-linked)        │
└────────┬─────────┴──────────┬────────────┴────────────┬──────────┘
         │                    │ (streaming SSE)          │
┌────────▼────────────────────▼──────────────────────────▼─────────┐
│                  Next.js App Router (Route Handlers)              │
├──────────────────┬───────────────────────┬───────────────────────┤
│  /api/upload     │  /api/generate        │  /api/export          │
│  /api/jobs       │  /api/compliance      │  /api/profile         │
└────────┬─────────┴──────────┬────────────┴────────────┬──────────┘
         │                    │                          │
┌────────▼────────────────────▼──────────────────────────▼─────────┐
│                        Service Layer                              │
├──────────────────┬───────────────────────┬───────────────────────┤
│  IngestService   │  ClaudeService        │  ExportService        │
│  (parse PDF/doc) │  (prompts + schemas)  │  (docx + pdf render)  │
└────────┬─────────┴──────────┬────────────┴────────────┬──────────┘
         │                    │                          │
┌────────▼────────────────────▼──────────────────────────▼─────────┐
│                        Data Layer (Supabase)                      │
├──────────────────┬───────────────────────┬───────────────────────┤
│  Storage         │  Postgres             │  Realtime             │
│  (raw files)     │  (jobs, proposals,    │  (job status push     │
│                  │   profiles, matrices) │   to browser)         │
└──────────────────┴───────────────────────┴───────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────────┐
│                   Background Job Runner (Supabase Edge Functions) │
│  job_processor: poll jobs table → parse → call Claude → persist  │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Upload UI | Accept PDF/Word drag-drop, validate size/type, trigger upload | Next.js client component + Supabase Storage presigned URL |
| Document Parser | Extract plain text from PDF or .docx | `unpdf` (PDF), `officeParser` (Word) — server-side only |
| Job Queue | Track async processing status, prevent duplicate execution | Supabase `jobs` table with status enum + pg_cron trigger |
| ClaudeService | Encapsulate all Claude API calls — prompts, schemas, model selection | Server-side module; never called from client |
| IngestPipeline | Orchestrate: raw text → chunked → Claude extraction → structured JSON | Called from Edge Function background job |
| ComplianceMatrix | Store requirements as rows keyed to proposal sections | Postgres table; status updated by draft edits |
| DraftStore | Persist all proposal sections as JSON content | Supabase Postgres; TipTap JSON format |
| Rich Text Editor | In-browser editing of draft sections with compliance highlights | Tiptap + @tiptap/react; section-by-section instances |
| ExportService | Convert DraftStore JSON → .docx then optionally → PDF | `docx` npm library (server-side Route Handler) |
| ContractorProfile | Company certifications, NAICS, past performance, bios | Postgres table; injected into Claude prompts at generation time |
| Auth + Billing | Login, per-seat subscription enforcement | Supabase Auth + Stripe |

---

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, signup (unauthenticated)
│   ├── (dashboard)/              # Protected routes
│   │   ├── proposals/
│   │   │   ├── [id]/page.tsx     # Proposal editor shell
│   │   │   └── new/page.tsx      # Upload + create flow
│   │   └── profile/page.tsx      # Contractor profile editor
│   └── api/
│       ├── upload/route.ts       # Presign URL + create job row
│       ├── jobs/[id]/route.ts    # Job status polling endpoint
│       ├── generate/route.ts     # Streaming section generation
│       ├── compliance/route.ts   # Compliance matrix CRUD
│       └── export/route.ts       # Docx/PDF export trigger
│
├── services/                     # Pure server-side business logic
│   ├── claude/
│   │   ├── client.ts             # Anthropic SDK singleton
│   │   ├── prompts/              # One file per extraction type
│   │   │   ├── rfp-extraction.ts
│   │   │   ├── compliance-matrix.ts
│   │   │   ├── section-draft.ts
│   │   │   └── win-score.ts
│   │   └── schemas/              # Zod schemas for structured outputs
│   │       ├── rfp-structure.ts
│   │       ├── compliance-row.ts
│   │       └── win-score.ts
│   ├── ingest/
│   │   ├── parse-pdf.ts          # unpdf wrapper
│   │   ├── parse-docx.ts         # officeParser wrapper
│   │   └── pipeline.ts           # Orchestrator: parse → extract → store
│   └── export/
│       ├── to-docx.ts            # docx library builder
│       └── to-pdf.ts             # Puppeteer or docx → PDF
│
├── lib/                          # Shared utilities
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   └── server.ts             # Server client (cookies)
│   └── stripe/
│       └── client.ts
│
├── components/                   # UI components
│   ├── editor/
│   │   ├── ProposalEditor.tsx    # Tiptap editor wrapper
│   │   ├── SectionPanel.tsx      # Single section with regenerate button
│   │   └── ComplianceHighlight.tsx
│   ├── compliance/
│   │   └── ComplianceMatrix.tsx  # Requirement checklist sidebar
│   └── upload/
│       └── UploadDropzone.tsx
│
└── supabase/
    ├── migrations/               # SQL schema migrations
    └── functions/
        └── job-processor/        # Edge Function background worker
            └── index.ts
```

### Structure Rationale

- **services/claude/**: All Claude calls isolated here. Prompts are code, not string literals in handlers. Schemas enforce structure at compile time.
- **services/ingest/**: Document parsing separated from AI calls — lets you test parsing without Claude, swap parsers without touching prompts.
- **supabase/functions/**: Background worker lives close to the DB config. Runs as Edge Function triggered by pg_cron, not Vercel serverless.
- **app/api/**: Thin route handlers — validate, delegate to services, return. No business logic in handlers.

---

## Architectural Patterns

### Pattern 1: Async Job Queue for Document Processing

**What:** Upload triggers a row insert into a `jobs` table (status: `pending`). A pg_cron schedule fires an Edge Function every 30 seconds, which picks up pending jobs, runs the full ingest + Claude extraction pipeline, and updates status to `complete` or `failed`. The browser polls the job status endpoint or subscribes to Supabase Realtime.

**When to use:** Any Claude call that takes more than 2-3 seconds. Full RFP extraction will take 15-60 seconds. Never block the HTTP response for this.

**Trade-offs:** Adds one async hop. Simplifies error handling (failed jobs can be retried). Prevents Vercel function timeouts.

**Example:**
```typescript
// Route handler: accept upload, enqueue job
// app/api/upload/route.ts
export async function POST(req: Request) {
  const { fileKey, proposalId } = await req.json()

  await supabase.from('jobs').insert({
    proposal_id: proposalId,
    file_key: fileKey,
    status: 'pending',
    job_type: 'rfp_ingest',
  })

  return Response.json({ jobId, status: 'queued' })
}

// Edge Function: poll and process
// supabase/functions/job-processor/index.ts
const { data: job } = await supabase
  .from('jobs')
  .select()
  .eq('status', 'pending')
  .eq('job_type', 'rfp_ingest')
  .limit(1)
  .single()

if (!job) return

await supabase.from('jobs').update({ status: 'processing' }).eq('id', job.id)

try {
  await runIngestPipeline(job)
  await supabase.from('jobs').update({ status: 'complete' }).eq('id', job.id)
} catch (err) {
  await supabase.from('jobs').update({ status: 'failed', error: err.message }).eq('id', job.id)
}
```

### Pattern 2: Streaming for Section Drafting

**What:** Section generation (Executive Summary, Technical Approach, etc.) streams token-by-token into the editor using Vercel AI SDK + Claude. The user sees the draft appear in real time, not after a 20-second wait.

**When to use:** All user-initiated "generate" or "regenerate" actions in the editor. Not for background bulk operations.

**Trade-offs:** Requires client-side streaming hook. Cannot store the result until stream completes. Use `onFinish` callback to persist to Supabase.

**Example:**
```typescript
// app/api/generate/route.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { sectionType, rfpContext, contractorProfile, instructions } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM_PROMPTS[sectionType],
    messages: [
      { role: 'user', content: buildSectionPrompt(rfpContext, contractorProfile, instructions) }
    ],
    onFinish: async ({ text }) => {
      // Persist completed draft to Supabase after stream ends
      await persistSectionDraft(proposalId, sectionType, text)
    }
  })

  return result.toDataStreamResponse()
}

// Client component
const { messages, append, isLoading } = useChat({
  api: '/api/generate',
})
```

### Pattern 3: Structured Output for Batch Extraction

**What:** RFP parsing (requirements extraction, compliance matrix generation, win score) uses Claude's structured output with Zod schemas. Never use raw text parsing — schemas guarantee typed JSON that maps directly to DB inserts.

**When to use:** Any Claude call where you need structured data (not prose). Run inside the background job, not in a streaming route.

**Trade-offs:** Structured outputs add slight latency due to constrained decoding. Cost is input-heavy (full RFP in context). Use `claude-sonnet-4-6` for cost/accuracy balance; reserve `claude-opus-4-6` for win score reasoning.

**Example:**
```typescript
// services/claude/schemas/compliance-row.ts
import { z } from 'zod'

export const ComplianceRowSchema = z.object({
  requirement_id: z.string(),
  text: z.string(),
  mandatory: z.boolean(),
  source_section: z.string(),
  evaluation_criterion: z.string().optional(),
})

export const ComplianceMatrixSchema = z.object({
  rows: z.array(ComplianceRowSchema),
  total_mandatory: z.number(),
  rfp_sections_found: z.array(z.string()),
})

// services/claude/client.ts — batch extraction call
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  output_config: {
    format: {
      type: 'json_schema',
      schema: zodToJsonSchema(ComplianceMatrixSchema),
    }
  },
  messages: [{ role: 'user', content: rfpText }]
})
```

---

## Data Flow

### Full Pipeline: Upload to Editable Draft

```
User uploads PDF/Word
        ↓
Browser: POST /api/upload
  → Supabase Storage: upload raw file
  → Supabase DB: INSERT jobs(status='pending')
  → Returns: { jobId }
        ↓
Browser: polls GET /api/jobs/{id} every 3s
  (or subscribes to Supabase Realtime channel)
        ↓
pg_cron (every 30s): fires Edge Function job-processor
  → SELECT job WHERE status='pending' LIMIT 1
  → UPDATE status='processing'
  → Download raw file from Supabase Storage
  → Parse: unpdf (PDF) or officeParser (Word) → plain text
  → If text > 180K tokens: chunk into 20K segments, meta-summarize
  → Claude (structured output): extract RFP structure
      → INSERT rfp_analysis (requirements, deadlines, criteria)
  → Claude (structured output): generate compliance matrix
      → INSERT compliance_matrix_rows[]
  → Claude (structured output): generate win probability score
      → INSERT win_score
  → Claude (streaming, section by section): draft 5 proposal sections
      → INSERT proposal_sections[]
  → UPDATE jobs(status='complete')
        ↓
Browser: detects status='complete'
  → Load proposal editor with all sections + compliance matrix
        ↓
User edits in Tiptap editor
  → Auto-save: PATCH /api/proposals/{id}/sections
  → Compliance matrix: tracks coverage as user edits
        ↓
User clicks "Export"
  → POST /api/export
  → Server: fetch all sections from DB
  → docx library: build Word document with styles
  → Stream .docx file back to browser
```

### State Management

```
Supabase DB (source of truth for all persisted state)
        ↓ (server components read)
Next.js RSC → Page hydration
        ↓ (client components manage local state)
React state (editor content, unsaved changes)
        ↓ (auto-save debounced 2s)
PATCH /api/proposals/{id}/sections → Supabase DB
```

### Key Data Flows

1. **Compliance linkage:** Each `compliance_matrix_row` has a `proposal_section_id` FK. As the editor content changes, a diff check updates row statuses (addressed / partial / missing) by scanning for requirement keywords. This runs client-side on debounced editor change, writes back via API.

2. **Contractor profile injection:** At generation time, `ClaudeService` fetches the user's `contractor_profile` row and injects it into the prompt system message. The profile is never embedded at parse time — always fetched fresh so updates apply to regenerations.

3. **Token budget management:** Full RFP text is passed directly to Claude for documents under ~150K tokens (standard RFPs fit easily). For oversized documents, the ingest pipeline uses meta-summarization: chunk at 20K characters → summarize each chunk → combine summaries into a structured extraction pass. This is a fallback path, not the default.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users | Current architecture is sufficient. Supabase free/pro handles load. Single Edge Function job processor. Vercel hobby/pro for Next.js. |
| 500-5K users | Add pg_cron parallelism (multiple job workers). Add Redis/Upstash for job queue if Supabase queue throughput limits. Cache Claude responses for identical RFP sections. |
| 5K+ users | Separate background processing to dedicated workers (Inngest or Trigger.dev). Add CDN caching for export files. Consider Claude prompt caching (90% cost reduction on repeated RFP context). |

### Scaling Priorities

1. **First bottleneck:** Claude API rate limits and per-request cost. Mitigation: prompt caching for large context (RFP text), model tiering (Sonnet for drafts, Haiku for win score factors, Opus only for final compliance review).
2. **Second bottleneck:** Edge Function cold starts on job processor. Mitigation: keep warm with pg_cron pings, or move to Inngest which maintains persistent workers.

---

## Anti-Patterns

### Anti-Pattern 1: Calling Claude Directly from Client Components

**What people do:** Expose Claude API key in browser env vars, call Anthropic SDK from React client components.

**Why it's wrong:** Exposes API key. Bypasses auth. No rate limiting. Cannot enforce per-seat billing.

**Do this instead:** All Claude calls happen in Route Handlers or Edge Functions. Client components call your `/api/generate` endpoint, which validates the session before touching Claude.

### Anti-Pattern 2: Blocking HTTP Response on Full RFP Processing

**What people do:** Upload triggers a synchronous API call that parses + Claude-extracts + drafts in one handler, returning when complete.

**Why it's wrong:** Vercel serverless functions timeout at 60s (Pro) or 10s (Hobby). RFP processing reliably takes 30-90 seconds. Users get 504 errors.

**Do this instead:** Queue pattern (Pattern 1 above). Return `{ jobId }` immediately. Let the Edge Function do the work asynchronously. Browser polls or subscribes to Realtime for status.

### Anti-Pattern 3: Storing Draft Content as Raw HTML

**What people do:** Save the editor's `.getHTML()` output directly to the database.

**Why it's wrong:** HTML is brittle for export, diff comparisons, and compliance scanning. Reconstruction of structure is error-prone.

**Do this instead:** Store Tiptap's `.getJSON()` output (ProseMirror JSON). It's structured, diffable, and maps cleanly to headings/paragraphs for docx export. Render HTML only at display time via `generateHTML()`.

### Anti-Pattern 4: One Giant Claude Prompt for Everything

**What people do:** Build a single mega-prompt: "Here is the RFP. Give me the compliance matrix, draft all 5 sections, score the win probability, and suggest improvements."

**Why it's wrong:** Output quality degrades. Structured schema compliance fails at large output sizes. If one section fails, you lose everything. Impossible to regenerate individual pieces.

**Do this instead:** Separate Claude calls per task, each with a focused prompt and its own schema. RFP extraction → compliance matrix → win score → draft per section. Run in sequence inside the background job. Each call persists independently.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | Server-side only via `@anthropic-ai/sdk`; also `@ai-sdk/anthropic` for streaming via Vercel AI SDK | Use `@ai-sdk/anthropic` for streaming drafts, bare Anthropic SDK for structured batch calls |
| Supabase Storage | Presigned URL upload from browser; server downloads via storage client for processing | Store raw files; processed text stored in DB, not files |
| Supabase Auth | SSR cookie-based via `@supabase/ssr`; middleware enforces auth on all `/dashboard/*` routes | Supabase JWT used to enforce per-seat billing check before each generation call |
| Stripe | Webhook updates `subscriptions` table; middleware reads subscription status before allowing AI calls | Block generation API if subscription inactive, not just on page load |
| Vercel | Deploys Next.js + API routes; Edge Functions handled by Supabase, not Vercel | Avoid Vercel Edge Runtime for background jobs — use Supabase Edge Functions for long-running work |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Browser ↔ API routes | REST + SSE (streaming) | No direct DB access from browser except Realtime subscriptions |
| API routes ↔ Services | Direct function call (same process) | Services are modules, not microservices — no HTTP between them |
| API routes ↔ Supabase | Supabase server client (service role key for write operations) | Never expose service role key client-side |
| Edge Function ↔ DB | Supabase client inside Edge Function with service role | Needs `SUPABASE_SERVICE_ROLE_KEY` in Edge Function env |
| ClaudeService ↔ Editor | Indirect: Claude writes to DB, editor reads from DB | No direct streaming pipe from background job to editor; streaming only for user-initiated regenerate |

---

## Build Order Implications

The dependency graph drives this order — each phase unblocks the next:

1. **Foundation** (Auth, DB schema, profile): Required before anything else. No AI calls work without a user context and contractor profile to inject.

2. **Upload + Parse Pipeline** (Storage, job queue, PDF/Word extraction): Must produce clean text before Claude can analyze anything. Validate this in isolation — parse 10 real RFPs, check text quality — before connecting Claude.

3. **RFP Analysis + Compliance Matrix** (Claude structured output, batch extraction): First Claude integration. Use structured outputs from day one — never raw text parsing. Compliance matrix feeds the editor UI.

4. **Proposal Drafting + Streaming Editor** (Claude streaming, Tiptap): Depends on parsed RFP context and contractor profile (step 1+2). Streaming is the UX — build it with streaming, not "load spinner then render."

5. **Export Pipeline** (docx generation): Depends on DraftStore having structured ProseMirror JSON. Build last — it's a one-way serialization step.

6. **Billing Enforcement** (Stripe + subscription gates): Add billing before first real user. Insert subscription check middleware into all `/api/generate` and `/api/compliance` routes.

---

## Sources

- [Claude Structured Outputs — Anthropic Platform Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — HIGH confidence, official
- [Claude Legal Summarization Guide — Anthropic Platform Docs](https://platform.claude.com/docs/en/about-claude/use-case-guides/legal-summarization) — HIGH confidence, official; chunking and meta-summarization patterns directly applicable
- [Vercel AI SDK — Next.js App Router Getting Started](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — HIGH confidence, official
- [Supabase Processing Large Jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — HIGH confidence, official Supabase blog
- [unpdf vs pdf-parse vs pdfjs — PkgPulse 2026 comparison](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — MEDIUM confidence, third-party review
- [GovEagle AI Proposal Tools roundup](https://www.goveagle.com/blog/ai-proposal-writing-tools-government-contractors) — MEDIUM confidence, competitor feature survey
- [docx npm library](https://github.com/dolanmiu/docx) — HIGH confidence, active maintained library (9.6.1, updated 2025)
- [Tiptap Next.js integration docs](https://tiptap.dev/docs/editor/getting-started/install/nextjs) — HIGH confidence, official

---
*Architecture research for: AI-assisted RFP proposal generation SaaS (HCC ProposalAI)*
*Researched: 2026-03-23*
