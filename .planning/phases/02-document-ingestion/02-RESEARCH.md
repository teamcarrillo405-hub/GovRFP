---
phase: 02
name: Document Ingestion
created: 2026-03-23
requirements: [INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05]
confidence: HIGH
---

# Phase 2: Document Ingestion — Research

**Researched:** 2026-03-23
**Domain:** File upload, async job processing, PDF/DOCX parsing, OCR, Supabase Storage + Realtime
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INGEST-01 | User can upload an RFP as a PDF file (up to 50MB) | Supabase Storage private bucket + signed upload URL pattern confirmed; 50MB limit matches free tier global max |
| INGEST-02 | User can upload an RFP as a Word (.docx) file (up to 50MB) | Same storage pattern; mammoth.js 1.12.0 `extractRawText({buffer})` confirmed for Node.js |
| INGEST-03 | System detects scanned PDFs and routes through OCR fallback automatically | Character-per-page heuristic confirmed (< 100 chars/page = scanned); AWS Textract at $0.0015/page recommended over Tesseract.js for government docs |
| INGEST-04 | Background job with progress indicator + real-time notification when done | Supabase `document_jobs` table as queue + pg_cron polling Edge Function + Supabase Realtime Postgres Changes confirmed |
| INGEST-05 | Parsed RFP structure sidebar (section outline + requirement list) | Stored as JSONB in `proposals` table; rendered from `rfp_structure` column; deferred to FUTURE-02 per REQUIREMENTS.md — see note below |
</phase_requirements>

> **INGEST-05 scope note:** REQUIREMENTS.md lists INGEST-05 as a v1 requirement, but the Deferred section in REQUIREMENTS.md also lists FUTURE-02 as "RFP structure sidebar during editing — deferred." There is a conflict. This research treats INGEST-05 as in-scope per the Phase 2 assignment. The planner should flag this with the user and default to: parse and store the `rfp_structure` JSON in Phase 2, but defer the sidebar UI component to Phase 3/4.

---

## Summary

Phase 2 adds the document ingestion pipeline: file upload, async background processing, text extraction (with OCR fallback), and real-time status feedback. It is the foundation all subsequent phases depend on — Phase 3 (AI analysis) cannot run without clean extracted text.

The three pivotal decisions in this phase are: (1) **OCR vendor** — AWS Textract is the right choice for government documents; Tesseract.js is a memory-hostile option with ~85–90% accuracy that will fail on the complex layout and compressed scanned pages common in Federal RFPs; (2) **async job architecture** — a `document_jobs` Postgres table as a job queue, polled by a Supabase Edge Function on a 15-second pg_cron schedule, is the correct pattern for a Supabase-first stack; webhook-on-insert is viable for low traffic but fragile at any load; (3) **real-time feedback** — Supabase Realtime Postgres Changes filtered by `proposal_id` is simpler and more appropriate for job status than Broadcast, because the status lives in the database anyway and clients can resume after reconnect.

The critical deployment constraint is that **PDF parsing and OCR must NOT run inside a Next.js API route or Vercel serverless function**. Tesseract.js alone is ~85MB compressed and would blow through Vercel's 250MB function bundle limit. AWS Textract calls require multi-second round trips incompatible with Next.js edge runtime. All heavy parsing runs inside a Supabase Edge Function triggered by the job queue, completely decoupled from Vercel.

**Primary recommendation:** Upload directly from browser to Supabase Storage via a signed upload URL created server-side. On upload, insert a `document_jobs` row with status `pending`. A pg_cron-scheduled Edge Function polls every 15 seconds, claims the job, downloads the file, extracts text with `unpdf` (Node.js build), and if the scanned-PDF heuristic fires, sends the file bytes to AWS Textract. Results stored in `proposals.rfp_text` and `proposals.rfp_structure`. Progress broadcast via Realtime Postgres Changes on `document_jobs.status`.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md. Constraints from AGENTS.md and Phase 1 research:

- **Framework:** Next.js 16.2.1 — `proxy.ts` not `middleware.ts`; `cookies()` and `params` must be awaited
- **Auth client:** `@supabase/ssr` 0.9.0 — never `@supabase/auth-helpers-nextjs`
- **Server client:** `createServerClient` for server components/actions; `createBrowserClient` for client components
- **AI engine:** Claude API only (Anthropic) — no OpenAI or other LLM providers
- **Subscription gating:** All new proposal creation must pass `isSubscriptionActive()` check
- **No custom middleware logic** — must re-export `proxy.ts` from `middleware.ts`
- **Zod v4:** Error access via `parsed.error.issues`, not `parsed.error.errors`
- **Read Node.js guide in `node_modules/next/dist/docs/`** before writing any Next.js code (per AGENTS.md)
- **Out of scope:** No freemium, no multi-user collaboration, no RFP discovery
- **Vercel:** Function bundle ≤ 250MB; max execution 300s (Hobby) / 800s (Pro)

---

## Architecture Decision: Async Job Architecture

### Recommended: Postgres Job Queue + pg_cron + Edge Function

**Why not webhook-on-storage-INSERT:**
Supabase database webhooks watch `storage.objects` table, but there are **two inserts per upload** — the first is a speculative RLS-check that is immediately rolled back. The second is the real insert. This creates a phantom trigger on the first rollback. Filtering it requires checking the object exists in storage after the trigger fires. This is a documented footgun (Supabase GitHub discussion #19017, March 2024).

**Why not Next.js API route + fire-and-forget:**
Next.js API routes on Vercel have a 300s hard timeout and a 4.5MB request body limit. More critically, the 250MB compressed function bundle limit makes it impossible to include Tesseract.js (85MB wasm) or AWS Textract SDK + file buffer in the same function that handles HTTP routing. The architecture breaks at the point OCR is needed.

**Why not Inngest / Trigger.dev:**
Both are valid orchestration platforms, but introduce an external vendor dependency, a new secret, and a new billing relationship for what is a straightforward background job. The Supabase-native queue approach keeps all infra in one place.

**Chosen architecture: Postgres job table + pg_cron + Edge Function**

```
Browser
  └─→ [GET] /api/documents/upload-url    (Next.js Route Handler)
           └─→ supabase.storage.createSignedUploadUrl()
               + insert proposals row (status='processing')
               + insert document_jobs row (status='pending')
               └─→ returns { signedUrl, proposalId }

Browser
  └─→ [PUT] {signedUrl}                  (Supabase Storage — direct upload)
           └─→ File stored in storage/rfp-documents/{userId}/{proposalId}/original.{ext}

pg_cron (every 15 seconds)
  └─→ CALL process_document_jobs()       (Supabase Edge Function)
           └─→ SELECT pending job (FOR UPDATE SKIP LOCKED)
           └─→ UPDATE status='processing'
           └─→ Download file from Storage (signed URL, service role)
           └─→ Parse text (unpdf or mammoth.js)
           └─→ Scanned PDF check (< 100 chars/page average?)
           └─→ [if scanned] Call AWS Textract API
           └─→ Extract rfp_structure JSON
           └─→ UPDATE proposals SET rfp_text, rfp_structure, status='ready'
           └─→ UPDATE document_jobs SET status='completed'

Browser (Supabase Realtime)
  └─→ subscribed to postgres_changes on document_jobs
      WHERE proposal_id = {current}
      └─→ UI updates progress bar → "Ready" notification
```

**Supabase Edge Function limits (relevant to this choice):**
- Wall clock: 150s (free tier) / 400s (paid)
- CPU time: 2s maximum per request (excluding async I/O)
- Memory: 256MB
- `EdgeRuntime.waitUntil()` allows background tasks after HTTP response

The 2s CPU limit applies to processing cycles only, not to I/O wait time (AWS Textract API call). A typical 50-page government PDF OCR via Textract takes 3–8 seconds of wall clock but < 0.5s of actual CPU. This is well within limits.

**Fallback for free tier wall-clock (150s):** Process maximum 30 pages per job execution. For documents > 30 pages, chain job statuses using `page_offset` column on `document_jobs`. Almost all solicitation RFPs are under 30 pages of scanned content.

---

## Standard Stack

### Core Additions (Phase 2 installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| unpdf | 1.4.0 | PDF text extraction | Only PDF library confirmed to work in Edge runtimes; built on PDF.js v5; zero native deps |
| mammoth | 1.12.0 | DOCX text extraction | Gold-standard .docx parser; `extractRawText({buffer})` confirmed; handles arbitrary government Word files |
| @aws-sdk/client-textract | 3.1014.0 | OCR for scanned PDFs | $0.0015/page (vs Tesseract 85–90% accuracy); async API; no Lambda required; call direct from Edge Function |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tesseract.js | 7.0.0 | OCR fallback | NOT recommended for production. Only viable for dev/local testing with no AWS credentials. 256MB Edge Function memory limit makes it risky for large scanned docs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unpdf | pdf-parse 2.4.5 | pdf-parse is more popular (~2M/wk) but does NOT work in Edge runtime; requires Node.js only. unpdf supports both runtimes |
| unpdf | pdfjs-dist 4.x | Full Mozilla rendering stack; ~3M/wk downloads; does not work in Edge; significantly larger bundle |
| AWS Textract | Tesseract.js 7.0.0 | Tesseract runs in-process (no vendor dependency), but accuracy ~85–90% on noisy government scans, 256MB memory cap in Edge Functions is dangerous for multi-page TIFFs, and 85MB wasm pushes Vercel bundle near 250MB limit |
| AWS Textract | Google Document AI | More accurate on structured forms; $0.0065/page (4x Textract cost); higher setup friction; not standard for startups |
| Postgres job table | Supabase Queues (pgmq) | pgmq provides guaranteed delivery and visibility timeout (better at scale), but requires enabling the extension; Postgres table is simpler for Phase 2 MVP; can migrate to pgmq in Phase 3+ if needed |
| Realtime Postgres Changes | Realtime Broadcast | Broadcast is lower latency, but requires server-to-client HTTP API call from Edge Function; Postgres Changes on `document_jobs` is simpler and auto-reconnects |

**Installation:**
```bash
npm install unpdf mammoth @aws-sdk/client-textract
```

**Version verification (run before writing plan tasks):**
```bash
npm view unpdf version          # confirmed 1.4.0
npm view mammoth version        # confirmed 1.12.0
npm view @aws-sdk/client-textract version  # confirmed 3.1014.0
```

---

## Architecture Patterns

### Recommended File Structure (new files)

```
src/
  app/
    (dashboard)/
      proposals/
        new/
          page.tsx              # Upload form — file picker + drag-and-drop
        [id]/
          page.tsx              # Proposal detail — status indicator + sidebar
    api/
      documents/
        upload-url/
          route.ts              # POST: create signed upload URL + insert DB rows
  components/
    documents/
      FileUpload.tsx            # Client component — file picker, progress bar
      ProcessingStatus.tsx      # Client component — Realtime subscription, status badge
      RfpStructureSidebar.tsx   # Client component — section outline tree (INGEST-05)
  lib/
    documents/
      parse-pdf.ts              # unpdf wrapper: extractText(), detectScanned()
      parse-docx.ts             # mammoth wrapper: extractRawText()
      textract.ts               # AWS Textract client + async job poller
      rfp-structure.ts          # Section + requirement extraction from raw text
supabase/
  migrations/
    00002_document_ingestion.sql  # rfp_documents bucket policy + document_jobs + proposals columns
  functions/
    process-documents/
      index.ts                  # Edge Function: poll document_jobs, parse, OCR, update
```

### Pattern 1: Signed Upload URL (direct-to-Storage, avoids 4.5MB Vercel body limit)

The browser never sends the file through Next.js. A server action creates a time-limited signed URL; the client uploads directly to Supabase Storage.

```typescript
// src/app/api/documents/upload-url/route.ts
// Source: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName, fileType } = await request.json()
  // Validate: pdf or docx only
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowed.includes(fileType)) {
    return NextResponse.json({ error: 'File type not supported' }, { status: 400 })
  }

  // Create proposal row first (status = 'processing')
  const admin = createAdminClient()
  const { data: proposal } = await admin
    .from('proposals')
    .insert({ user_id: user.id, title: fileName, status: 'processing' })
    .select('id')
    .single()

  const ext = fileType === 'application/pdf' ? 'pdf' : 'docx'
  const storagePath = `${user.id}/${proposal.id}/original.${ext}`

  const { data: upload } = await admin.storage
    .from('rfp-documents')
    .createSignedUploadUrl(storagePath)

  // Insert job queue row
  await admin.from('document_jobs').insert({
    proposal_id: proposal.id,
    user_id: user.id,
    storage_path: storagePath,
    file_type: ext,
    status: 'pending',
  })

  return NextResponse.json({
    signedUrl: upload.signedUrl,
    token: upload.token,
    proposalId: proposal.id,
  })
}
```

### Pattern 2: Scanned PDF Detection Heuristic

```typescript
// src/lib/documents/parse-pdf.ts
// Source: research synthesis — industry standard character-density heuristic
import { extractText, getDocumentProxy } from 'unpdf'

export interface ParseResult {
  text: string
  pageCount: number
  isScanned: boolean
  charsPerPage: number[]
}

const SCANNED_CHARS_THRESHOLD = 100  // chars/page below this = likely scanned

export async function parsePdf(buffer: ArrayBuffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await extractText(pdf, { mergePages: false })

  // text is string[] when mergePages: false — one entry per page
  const pages = Array.isArray(text) ? text : [text]
  const charsPerPage = pages.map(p => (p ?? '').trim().length)
  const avgCharsPerPage = charsPerPage.reduce((a, b) => a + b, 0) / (charsPerPage.length || 1)
  const isScanned = avgCharsPerPage < SCANNED_CHARS_THRESHOLD

  return {
    text: pages.join('\n\n'),
    pageCount: totalPages,
    isScanned,
    charsPerPage,
  }
}
```

**Heuristic rationale:** A digitally-born PDF page of typical government body text contains 1,500–3,000 characters. A scanned PDF page returns 0–30 characters (metadata artifacts only). The 100-char threshold gives a generous safety margin. Per-page analysis catches hybrid docs (some pages scanned, some digital) — route the whole document through Textract if ANY page is under threshold. This is the industry-standard approach used in multi-stage OCR pipelines.

### Pattern 3: AWS Textract Integration

```typescript
// src/lib/documents/textract.ts
// Source: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_textract_code_examples.html
import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} from '@aws-sdk/client-textract'

const client = new TextractClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function extractTextWithTextract(
  s3Bucket: string,
  s3Key: string
): Promise<string> {
  // Start async job — Textract reads directly from S3
  const { JobId } = await client.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    })
  )

  // Poll until complete (typical: 3–15s for <50 pages)
  let result: string[] = []
  while (true) {
    const { JobStatus, Blocks, NextToken } = await client.send(
      new GetDocumentTextDetectionCommand({ JobId, NextToken: undefined })
    )
    if (JobStatus === 'FAILED') throw new Error('Textract job failed')
    if (JobStatus === 'SUCCEEDED') {
      const lines = (Blocks ?? [])
        .filter(b => b.BlockType === 'LINE')
        .map(b => b.Text ?? '')
      result.push(...lines)
      if (!NextToken) break
    }
    await new Promise(r => setTimeout(r, 1500))  // 1.5s poll interval
  }
  return result.join('\n')
}
```

> **Note:** AWS Textract async jobs read from S3, NOT from Supabase Storage. You must either: (a) mirror the uploaded file to an S3 bucket, or (b) use Textract's synchronous `DetectDocumentText` API with the raw bytes (supports up to 10MB). For RFPs under 10MB, use sync API with raw bytes. For RFPs 10–50MB that are scanned, mirror to S3. Government RFPs are almost universally under 10MB even scanned — use sync API as primary path, S3 mirror as fallback.

**Sync API pattern (primary — up to 10MB scanned PDFs):**
```typescript
import { DetectDocumentTextCommand } from '@aws-sdk/client-textract'

const { Blocks } = await client.send(
  new DetectDocumentTextCommand({
    Document: { Bytes: new Uint8Array(pdfBuffer) },  // raw bytes, no S3
  })
)
```

### Pattern 4: Supabase Realtime Job Status Subscription

```typescript
// src/components/documents/ProcessingStatus.tsx
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
'use client'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export function ProcessingStatus({ proposalId }: { proposalId: string }) {
  const [status, setStatus] = useState<JobStatus>('pending')
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel(`job-status-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'document_jobs',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => setStatus(payload.new.status as JobStatus)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [proposalId, supabase])

  // Render progress indicator based on status
  ...
}
```

### Pattern 5: Edge Function Job Processor

```typescript
// supabase/functions/process-documents/index.ts
// Source: https://supabase.com/docs/guides/functions/background-tasks
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Claim one pending job (FOR UPDATE SKIP LOCKED prevents double-processing)
  const { data: job } = await admin.rpc('claim_next_document_job')
  if (!job) return new Response('no jobs', { status: 200 })

  // Use waitUntil so HTTP responds immediately, processing continues
  EdgeRuntime.waitUntil(processJob(admin, job))
  return new Response('processing', { status: 202 })
})
```

### Anti-Patterns to Avoid

- **Sending file bytes through Next.js to Supabase:** Vercel's 4.5MB request body cap prevents uploading a 50MB PDF. Always use signed upload URLs — browser to Supabase Storage direct.
- **Calling Textract from a Next.js API route:** AWS SDK credentials in browser-accessible server components. Also breaks the async job pattern — Textract async jobs are long-polling.
- **Using Tesseract.js in Edge Function:** 85MB WASM file, plus per-document memory allocation that cannot be freed, in a 256MB memory-capped environment. Will OOM on a 20-page scanned RFP.
- **Triggering Edge Function on storage.objects INSERT:** Fires twice per upload (speculative RLS check + real insert). Requires non-obvious filtering and retry logic.
- **Storing raw text in Storage instead of Postgres:** Adds a second fetch round-trip for every AI analysis call. Store `rfp_text` in `proposals` table directly.
- **unpdf with Node.js < 22 without polyfill:** PDF.js v5 uses `Promise.withResolvers` — use the bundled serverless build of unpdf, which includes the polyfill, rather than the default build.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `unpdf` 1.4.0 | PDF spec is ~750 pages; font encoding, cross-reference tables, linearized PDFs are all edge cases |
| DOCX text extraction | ZIP + XML parse loop | `mammoth` 1.12.0 | OOXML schema has ~3,000 element types; content types, relationships, numbering XML are all interdependent |
| Scanned PDF OCR | Hand-rolled Tesseract integration | `@aws-sdk/client-textract` | Language model + layout analysis built-in; handles rotated pages, mixed-DPI, poor scan quality |
| Background job queue | Custom polling + locking | Postgres `FOR UPDATE SKIP LOCKED` + pg_cron | Advisory locks, double-processing prevention, job starvation all require careful DB primitives |
| Real-time status | WebSocket server | Supabase Realtime Postgres Changes | WebSocket infra + reconnection + authentication is a product unto itself |

---

## Scanned PDF Detection: Exact Heuristic

**Rule:** After `unpdf.extractText()`, compute average characters per page. If `avg < 100`, classify as scanned.

```typescript
const SCANNED_THRESHOLD = 100  // characters per page

function isScannedPdf(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return true
  const total = pageTexts.reduce((sum, p) => sum + p.trim().length, 0)
  const avg = total / pageTexts.length
  return avg < SCANNED_THRESHOLD
}
```

**Why 100 chars/page:**
- Digital PDF page: 1,500–3,000 chars
- Scanned PDF page (OCR failed): 0–30 chars (metadata: page labels, fonts)
- Worst-case digital page (cover page, mostly graphics): 150–400 chars
- 100 chars/page threshold safely separates scanned from digital, even for cover pages

**Hybrid document handling:** If `isScannedPdf()` is `true` for ANY page individually (not just average), route the entire document through Textract. Do not attempt selective OCR — partial text creates confusing mixed-quality output for the AI analysis stage.

**Page-level check:**
```typescript
const anyPageBelow = pageTexts.some(p => p.trim().length < SCANNED_THRESHOLD)
const isScanned = anyPageBelow || avgCharsPerPage < SCANNED_THRESHOLD
```

---

## Database Schema Changes (Migration 00002)

```sql
-- 00002_document_ingestion.sql

-- =========================================================
-- Extend proposals table for document ingestion (INGEST-01..05)
-- =========================================================
alter table public.proposals
  add column file_name        text,
  add column file_type        text check (file_type in ('pdf', 'docx')),
  add column storage_path     text,
  add column rfp_text         text,
  add column rfp_structure    jsonb,       -- {sections: [], requirements: []}
  add column page_count       integer,
  add column is_scanned       boolean default false,
  add column ocr_used         boolean default false;

-- =========================================================
-- Job queue table (INGEST-04 async job)
-- =========================================================
create table public.document_jobs (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals(id) on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  storage_path  text not null,
  file_type     text not null check (file_type in ('pdf', 'docx')),
  status        text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  page_offset   integer default 0,   -- for chunked processing of large docs
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.document_jobs enable row level security;

-- Users can read their own jobs (for Realtime subscription)
create policy "Users can view own document_jobs"
  on document_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create index on document_jobs (status, created_at);  -- job poller index
create index on document_jobs (proposal_id);          -- Realtime filter index
create index on document_jobs (user_id);

-- =========================================================
-- Claim job function (atomic — prevents double-processing)
-- =========================================================
create or replace function public.claim_next_document_job()
returns setof public.document_jobs
language plpgsql
security definer
as $$
begin
  return query
  update public.document_jobs
  set status = 'processing', started_at = now(), updated_at = now()
  where id = (
    select id from public.document_jobs
    where status = 'pending'
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

-- =========================================================
-- Supabase Storage bucket configuration
-- Run in Supabase dashboard (cannot do via migration)
-- =========================================================
-- Bucket name: rfp-documents
-- Type: Private (not public)
-- File size limit: 50MB (matches free tier global limit)
-- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- RLS policies on storage.objects:
-- INSERT: auth.uid()::text = (storage.foldername(name))[1]
-- SELECT: auth.uid()::text = (storage.foldername(name))[1]
-- DELETE: auth.uid()::text = (storage.foldername(name))[1]
-- Storage path convention: {userId}/{proposalId}/original.{ext}

-- =========================================================
-- pg_cron: poll every 15 seconds
-- Run in Supabase dashboard SQL editor (requires pg_cron extension)
-- =========================================================
-- select cron.schedule('process-documents', '*/15 * * * * *',
--   $$select net.http_post(
--     url := 'https://{project-ref}.functions.supabase.co/process-documents',
--     headers := '{"Authorization": "Bearer {anon-key}"}'::jsonb
--   )$$
-- );
```

---

## Supabase Storage Configuration

**Bucket:** `rfp-documents` (private)

| Property | Value | Reason |
|----------|-------|--------|
| Type | Private | Files contain sensitive procurement docs — never public URLs |
| Global file size limit | 50MB | Matches Supabase free tier maximum global limit |
| Per-bucket file size limit | 50MB | Set to match global to be explicit |
| Allowed MIME types | `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Reject early rather than at parse time |

**Signed URL flow:**
1. Server creates signed upload URL via `admin.storage.from('rfp-documents').createSignedUploadUrl(path)` — expires in 1 hour
2. Client uploads directly to that URL (bypasses 4.5MB Vercel limit)
3. Server creates signed download URL via `admin.storage.from('rfp-documents').createSignedUrl(path, 600)` — used by Edge Function to download for parsing

**Free tier storage:** Supabase free tier includes 1GB Storage total. A 50MB RFP limit means ~20 documents before hitting free tier storage limit. For production, upgrade to Pro ($25/month, 100GB storage).

---

## Real-time Pattern: Supabase Realtime Setup

**Choice: Postgres Changes over Broadcast**

Broadcast requires an HTTP API call from the Edge Function to the Supabase Realtime REST endpoint to push messages. Postgres Changes fires automatically when `document_jobs` rows are updated. Since job status is persisted in the database anyway, Postgres Changes is the natural fit and requires zero additional code in the Edge Function.

```typescript
// Client subscription (ProcessingStatus.tsx)
const channel = supabase
  .channel(`job-${proposalId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'document_jobs',
    filter: `proposal_id=eq.${proposalId}`,
  }, (payload) => {
    const { status, error_message } = payload.new
    // Update UI: pending → processing → completed / failed
  })
  .subscribe()
```

**RLS requirement for Postgres Changes:** The `document_jobs` table has RLS enabled with `auth.uid() = user_id` policy. Realtime respects this — clients only receive updates for their own rows. Enable Realtime on this table in Supabase dashboard (Database > Replication > document_jobs).

**Progress stages displayed:**
1. `pending` — "Uploading…" (file upload in progress or queued)
2. `processing` — "Analyzing document…" (Edge Function working)
3. `completed` — "Ready" (green badge, unlock Phase 3 features)
4. `failed` — "Processing failed" + error message (retry button)

---

## Common Pitfalls

### Pitfall 1: unpdf Node.js < 22 `Promise.withResolvers` Crash
**What goes wrong:** `TypeError: Promise.withResolvers is not a function` at startup when using unpdf with the default PDF.js build in Node.js 18–21.
**Why it happens:** PDF.js v5 uses `Promise.withResolvers`, added in Node.js 22. The project CLAUDE.md requires Node.js 20.9+.
**How to avoid:** Import from the bundled serverless build: `import { extractText } from 'unpdf/serverless'` or set `UNPDF_BUILD=serverless`. Verify: `node --version` should show v22+ if you upgrade; otherwise always use the serverless import.
**Warning signs:** Crash at module load, not during PDF processing.

### Pitfall 2: Double-Trigger on storage.objects INSERT
**What goes wrong:** Your Edge Function runs twice per upload — once with a phantom row that doesn't exist in storage, causing a 404 download error.
**Why it happens:** Supabase Storage does a speculative RLS check that creates and immediately rolls back an `storage.objects` row before the real insert. Any trigger or webhook on `storage.objects` INSERT fires on both.
**How to avoid:** Use the job queue pattern (browser → API route → `document_jobs` INSERT) instead of triggering on storage.objects. The API route only inserts the job row after upload URL creation, not after the upload completes — but the Edge Function downloads via signed URL and will naturally retry if the file isn't there yet.
**Warning signs:** Duplicate job rows, 404 errors from storage download immediately after trigger.

### Pitfall 3: AWS Textract Byte Limit for Sync API
**What goes wrong:** `InvalidParameterException: Document too large` when sending a scanned PDF > 10MB to `DetectDocumentText` (sync).
**Why it happens:** Textract sync API (`DetectDocumentText`) has a 10MB document size limit. Async API (`StartDocumentTextDetection`) has no practical limit but requires S3.
**How to avoid:** Check file size before calling Textract. If > 10MB, use the async S3 path. For MVP: reject scanned PDFs > 10MB with a user-friendly error ("This scanned document is too large for OCR. Please upload a digitally-born PDF."). Government RFPs are almost always under 10MB scanned.
**Warning signs:** Textract exception on files 10–50MB that are scanned.

### Pitfall 4: mammoth.js Tracked Changes Noise
**What goes wrong:** `extractRawText()` on a government DOCX with tracked changes returns duplicate text — both the original and the revision.
**Why it happens:** mammoth.js includes both accepted and revision text when tracked changes are present in the OOXML.
**How to avoid:** Run a post-processing step to deduplicate adjacent near-identical paragraphs, or advise users to Accept All Changes before uploading. Log a warning in the job error_message when the DOCX word count seems abnormally high (> 100k words for a typical RFP).
**Warning signs:** rfp_text for a DOCX is twice the expected length; duplicate requirement extraction in Phase 3.

### Pitfall 5: Supabase Free Tier Wall-Clock Limit (150s)
**What goes wrong:** Edge Function times out processing a 50-page scanned PDF via Textract with polling.
**Why it happens:** Free tier wall-clock limit is 150s; Textract can take 30–90s for 50 dense pages. Plus file download, parsing, and DB writes.
**How to avoid:** Use `page_offset` on `document_jobs` to break large documents into 30-page chunks. For MVP: add a `max_pages = 30` guard with a clear user message ("Processing first 30 pages. Upload a shorter excerpt for faster results."). Upgrade to Supabase Pro ($25/month) for 400s wall-clock limit before launch.
**Warning signs:** `wall clock time limit reached` in Edge Function logs; `document_jobs.status` stuck on `processing`.

---

## Code Examples

### DOCX text extraction (mammoth.js)

```typescript
// src/lib/documents/parse-docx.ts
// Source: https://github.com/mwilliamson/mammoth.js
import mammoth from 'mammoth'

export async function parseDocx(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: result.value,
    warnings: result.messages.map(m => m.message),
  }
}
```

### Job queue atomic claim (SQL)

```sql
-- FOR UPDATE SKIP LOCKED: atomic claim, no double-processing
-- Source: PostgreSQL docs — concurrent queue pattern
SELECT * FROM document_jobs
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

### RFP structure extraction (raw heuristic — no AI needed in Phase 2)

```typescript
// src/lib/documents/rfp-structure.ts
// Extracts section headings and "shall/must/will" requirement sentences
export function extractRfpStructure(text: string) {
  // Section heading heuristic: all-caps lines or numbered headings
  const sectionRegex = /^(SECTION\s+[A-Z]|[A-Z]{2,}[^a-z\n]{0,60}$|\d+\.\d*\s+[A-Z])/gm
  const sections = [...text.matchAll(sectionRegex)].map(m => m[0].trim())

  // Requirement sentence heuristic
  const reqRegex = /[^.!?]*\b(shall|must|will)\b[^.!?]*[.!?]/gi
  const requirements = [...text.matchAll(reqRegex)].map(m => m[0].trim())

  return { sections, requirements }
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime | Must verify | 20.9+ required | Upgrade if < 20.9 |
| Supabase CLI | Edge Function deploy | Check: `supabase --version` | — | Install: `npm i -g supabase` |
| AWS credentials | Textract OCR | Must configure | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Dev: use Tesseract.js fallback |
| pg_cron | Job polling scheduler | Enabled on Supabase by default | Built-in | Enable via SQL: `create extension if not exists pg_cron` |
| Supabase Pro | 400s wall-clock limit | Free tier sufficient for dev | 150s free / 400s Pro | Accept 30-page limit on free tier |

**Missing dependencies with no fallback:**
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) — required for OCR on scanned PDFs in production. Must be added to `.env.local` and Supabase Edge Function secrets.

**Missing dependencies with fallback:**
- Supabase Pro wall-clock: Free tier (150s) sufficient for dev and documents < 30 pages.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdf-parse (node-only) | unpdf (edge-compatible) | 2023 | Can run in Supabase Edge Functions; pdf-parse still works for Node-only contexts |
| Polling Next.js API routes for job status | Supabase Realtime Postgres Changes | 2022 | Eliminates polling loop; WebSocket-based push |
| Tesseract.js for all OCR | AWS Textract for high-accuracy OCR | 2020+ | Textract at $0.0015/page is cost-effective; accuracy gap is too large for production government docs |
| middleware.ts | proxy.ts (Next.js 16) | Oct 2025 | Session refresh and route protection must live in proxy.ts |
| @supabase/auth-helpers-nextjs | @supabase/ssr 0.9.0 | 2023 | Official replacement; cookie-based session for App Router |

**Deprecated/outdated:**
- `pdf-parse`: Not Edge-compatible; maintenance pace has slowed; unpdf is the successor for new projects
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`; do not add to Phase 2 code
- Tesseract.js in Edge/serverless: Memory constraints and bundle size make this impractical for production

---

## Open Questions

1. **INGEST-05 scope conflict**
   - What we know: REQUIREMENTS.md marks INGEST-05 (parsed RFP structure sidebar) as v1. The Deferred section marks FUTURE-02 (same feature) as v2.
   - What's unclear: Does the user want the sidebar UI in Phase 2, or only the data structure (JSON stored in DB) now and the UI in Phase 3?
   - Recommendation: Parse and store `rfp_structure` JSON in Phase 2 (zero extra cost — it's a regex pass over extracted text). Defer the sidebar React component to Phase 4 (Editor phase). Flag this decision in PLAN.

2. **AWS Textract S3 requirement for files > 10MB**
   - What we know: Sync API limit is 10MB; government scanned RFPs are almost always < 10MB.
   - What's unclear: Whether to implement S3 mirror path for Phase 2 MVP or add a user-facing size check/rejection.
   - Recommendation: Add a pre-upload file size check. If file is scanned PDF > 10MB: reject with message. Implement S3 async path in Phase 3 only if user data shows > 10MB scanned uploads are common.

3. **pg_cron 15-second granularity**
   - What we know: `pg_cron` supports second-level granularity in Supabase (`*/15 * * * * *`).
   - What's unclear: Whether Supabase's managed pg_cron supports sub-minute scheduling on the free tier, or only per-minute.
   - Recommendation: Plan for 1-minute polling as the fallback (`* * * * *`). If 15-second is available, use it. Document in Wave 0 that this needs manual verification in the Supabase dashboard.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (existing) |
| Config file | `vitest.config.ts` (existing from Phase 1) |
| Quick run command | `npx vitest run tests/documents/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INGEST-01 | Upload URL API returns signed URL + inserts proposal + inserts job row | unit | `npx vitest run tests/documents/upload-url.test.ts` | Wave 0 |
| INGEST-01 | Rejects non-PDF/DOCX file types | unit | `npx vitest run tests/documents/upload-url.test.ts` | Wave 0 |
| INGEST-01 | Rejects unauthenticated request | unit | `npx vitest run tests/documents/upload-url.test.ts` | Wave 0 |
| INGEST-02 | DOCX upload accepted by upload-url API | unit | `npx vitest run tests/documents/upload-url.test.ts` | Wave 0 |
| INGEST-02 | mammoth.extractRawText parses sample DOCX correctly | unit | `npx vitest run tests/documents/parse-docx.test.ts` | Wave 0 |
| INGEST-03 | `isScannedPdf()` returns `true` for 0-char-per-page input | unit | `npx vitest run tests/documents/parse-pdf.test.ts` | Wave 0 |
| INGEST-03 | `isScannedPdf()` returns `false` for 1500-char-per-page input | unit | `npx vitest run tests/documents/parse-pdf.test.ts` | Wave 0 |
| INGEST-03 | `isScannedPdf()` returns `true` when ANY page is below threshold | unit | `npx vitest run tests/documents/parse-pdf.test.ts` | Wave 0 |
| INGEST-04 | `claim_next_document_job` returns pending job and marks it processing | integration | `npx vitest run tests/documents/job-queue.test.ts` | Wave 0 |
| INGEST-04 | Processing status Realtime subscription receives UPDATE event | integration | manual (requires running Supabase) | manual-only |
| INGEST-05 | `extractRfpStructure()` finds sections from sample RFP text | unit | `npx vitest run tests/documents/rfp-structure.test.ts` | Wave 0 |
| INGEST-05 | `extractRfpStructure()` finds "shall" requirement sentences | unit | `npx vitest run tests/documents/rfp-structure.test.ts` | Wave 0 |

**Manual-only tests (with justification):**
- Realtime subscription end-to-end: Requires live Supabase WebSocket; cannot mock in Vitest unit test. Verified manually during Wave 3 verification step.
- Textract OCR accuracy: Requires AWS credentials and a real scanned PDF. Verified manually in dev environment before launch.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/documents/`
- **Per wave merge:** `npx vitest run` (full 34+ test suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps (new test files to create)

- [ ] `tests/documents/upload-url.test.ts` — covers INGEST-01, INGEST-02 (upload URL API unit tests)
- [ ] `tests/documents/parse-pdf.test.ts` — covers INGEST-03 (scanned detection heuristic unit tests)
- [ ] `tests/documents/parse-docx.test.ts` — covers INGEST-02 (mammoth.js extraction unit tests)
- [ ] `tests/documents/job-queue.test.ts` — covers INGEST-04 (claim_next_document_job RPC)
- [ ] `tests/documents/rfp-structure.test.ts` — covers INGEST-05 (section + requirement extraction)
- [ ] `tests/fixtures/sample.pdf` — digitally-born PDF fixture (small, 2-page)
- [ ] `tests/fixtures/sample-scanned.pdf` — scanned PDF fixture (zero text per page)
- [ ] `tests/fixtures/sample.docx` — DOCX fixture (basic government format)

---

## Risks

### Risk 1: Tesseract.js Temptation (HIGH probability, HIGH impact)
**Description:** A planner or implementer may reach for Tesseract.js to avoid adding AWS credentials to the project. Tesseract.js is easy to install and "just works" in demos.
**Why it fails in production:** (a) tesseract.js 7.0.0 is ~85MB compressed WASM — blows Vercel's 250MB function bundle limit if included in Next.js. (b) 256MB Edge Function memory limit with a 30-page scanned PDF will OOM. (c) 85–90% accuracy on poor-quality government scans creates hallucinated requirements in Phase 3 AI analysis. (d) Gov documents often use custom fonts, rotated text, and degraded scanner output — exactly the failure modes where Tesseract falls apart.
**Mitigation:** Tesseract.js is listed as a dev-only fallback in this research. Planner MUST use AWS Textract in all production code paths.

### Risk 2: Edge Function Wall-Clock Timeout on Large Scanned Docs (MEDIUM probability, HIGH impact)
**Description:** A 50-page scanned PDF sent to AWS Textract async API + polling can take 60–90 seconds. Add file download (5–15s) and DB writes (1–2s) = possible 150s+ total on free tier.
**Mitigation:** (a) Use Textract sync API (no polling) for files < 10MB — typical for government RFPs. Sync API returns in 3–8s. (b) Add `max_pages = 30` guard. (c) Upgrade to Supabase Pro ($25/mo) before production launch for 400s wall-clock. (d) Implement `page_offset` chunking in `document_jobs` as a Phase 2 deliverable.

### Risk 3: Supabase Free Tier Storage Limit (LOW probability, MEDIUM impact)
**Description:** Free tier provides 1GB storage. At 50MB max file size, that's ~20 uploads before hitting the limit. In development and early beta, this is fine. If a demo or trial goes viral, it can fill up unexpectedly.
**Mitigation:** (a) Add a storage usage check in the upload API route — reject if > 800MB used. (b) Add a cleanup job to delete original files after rfp_text is extracted (the extracted text is far smaller). (c) Plan to upgrade to Supabase Pro at first paying customer.

---

## Sources

### Primary (HIGH confidence)
- Supabase Docs — Edge Function Limits: https://supabase.com/docs/guides/functions/limits (confirmed: 2s CPU, 150s/400s wall-clock, 256MB memory)
- Supabase Docs — Background Tasks: https://supabase.com/docs/guides/functions/background-tasks (EdgeRuntime.waitUntil pattern confirmed)
- Supabase Docs — Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes (filter by column, RLS, UPDATE events)
- Supabase Docs — Storage Bucket Fundamentals: https://supabase.com/docs/guides/storage/buckets/fundamentals (private bucket + signed URLs)
- Supabase Docs — Storage File Limits: https://supabase.com/docs/guides/storage/uploads/file-limits (50MB free tier confirmed)
- AWS Textract Pricing Page: https://aws.amazon.com/textract/pricing/ ($0.0015/page DetectDocumentText confirmed)
- Vercel Functions Limits: https://vercel.com/docs/functions/limitations (300s timeout, 4.5MB body, 250MB bundle)
- unpdf GitHub: https://github.com/unjs/unpdf (Edge runtime support, PDF.js v5.4.394 base confirmed)

### Secondary (MEDIUM confidence)
- pkgpulse.com 2026 comparison: https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026 (unpdf recommended for edge runtimes, verified against official docs)
- jigz.dev background jobs: https://www.jigz.dev/blogs/how-i-solved-background-jobs-using-supabase-tables-and-edge-functions (job queue pattern verified against Supabase official docs)
- Supabase blog — Processing Large Jobs: https://supabase.com/blog/processing-large-jobs-with-edge-functions (cron + queue architecture confirmed)
- Springer Nature OCR benchmarking: https://link.springer.com/article/10.1007/s42001-021-00149-1 (Textract > Tesseract accuracy on noisy docs)

### Tertiary (LOW confidence — flagged for validation)
- mammoth.js tracked-changes behavior: inferred from GitHub issues and documentation warnings. Needs real government DOCX test to confirm severity.
- pg_cron sub-minute (15s) scheduling on Supabase free tier: not confirmed. Plan assumes 1-minute fallback is safe; test at Wave 0.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry; edge runtime support confirmed via official docs
- Architecture: HIGH — Supabase-native queue pattern confirmed via official blog + community; Vercel limits verified
- OCR decision: HIGH — Textract pricing confirmed via AWS pricing page; accuracy comparison from peer-reviewed research
- Pitfalls: HIGH for pitfalls 1, 2, 3; MEDIUM for pitfall 4 (mammoth tracked changes: inferred, not directly verified)

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable stack, 90-day window; re-verify unpdf version and Textract pricing at implementation)
