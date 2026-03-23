# Phase 4: Proposal Drafting + Editor — Research

**Researched:** 2026-03-23
**Domain:** Tiptap v2, Claude streaming, Supabase auto-save, compliance highlighting
**Confidence:** HIGH (stack verified against installed packages and npm registry)

---

## Summary

Phase 4 is the core product experience — five AI-drafted proposal sections, a rich text editor, 30-second auto-save, and live compliance gap highlighting. The work splits cleanly into three layers: (1) the Claude streaming API route that generates section drafts, (2) the Tiptap v2 editor setup with the exact extension list needed, and (3) the compliance highlighting system that watches for keywords and marks unaddressed requirements in-line.

The key technical challenge is streaming: Claude returns text as an SSE stream, the Next.js App Router route handler must pass that stream directly to the browser as a `ReadableStream`, and the client component must read chunks and insert them into the Tiptap editor without creating a ProseMirror transaction per character. The right approach is to buffer each chunk into a string accumulator and call `editor.commands.setContent()` once the stream completes — or use `insertContent()` with a full Markdown-to-document conversion. Attempting to `insertContent` on every SSE chunk produces hundreds of ProseMirror transactions per second and will freeze the browser.

The compliance highlighting (EDITOR-04) is a custom Tiptap Mark extension — not the Decoration API. A `ComplianceGap` mark is applied programmatically after each auto-save by scanning the section content for keyword absence, then marking those paragraph regions with a distinct background color. The mark must be excluded from the output used for export (strip it from the Tiptap JSON before passing to Phase 5).

**Primary recommendation:** Use `@tiptap/react@2.27.2` with `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-underline`, and `@tiptap/pm` pinned at `2.27.2`. Stream Claude via raw Next.js App Router route handler returning `new Response(readableStream)` — skip Vercel AI SDK (`ai@6`) because its abstractions conflict with prompt caching patterns already established in Phase 3.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAFT-01 | Generate Executive Summary from profile + RFP | Claude streaming API route + profile injection pattern |
| DRAFT-02 | Generate Technical Approach from RFP requirements + past perf | Compliance matrix from `rfp_analysis` fed into prompt |
| DRAFT-03 | Generate Management Plan including key personnel bios | `key_personnel` table join + streaming |
| DRAFT-04 | Generate Past Performance section from matched projects | `past_projects` table join + RFP scope matching in prompt |
| DRAFT-05 | Generate Price Narrative (no numbers) | Simplified prompt, same streaming route |
| DRAFT-06 | Regenerate any section with optional instruction string | `instruction` field in POST body, same route |
| EDITOR-01 | Rich text editor: headings, bullets, numbered, bold, italic, underline, tables | Tiptap v2 StarterKit + Table + Underline extensions |
| EDITOR-02 | Auto-save every 30s with visible timestamp | `useInterval` debounce + Supabase upsert + `saved_at` state |
| EDITOR-03 | Compliance matrix updates coverage as user edits | keyword scan on `editor.getJSON()` after each save |
| EDITOR-04 | Highlight uncovered text regions with visual marker | Custom Tiptap Mark extension (`ComplianceGap`) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

### Locked Decisions

- **Tiptap v2** — NOT v3 (API still in flux). The `v2-latest` dist-tag on npm is `2.27.2`. Pin to `2.27.2` for all packages.
- **`@supabase/ssr`** — never `@supabase/auth-helpers-nextjs`
- **`getUser()` not `getSession()`** server-side
- **`createServerClient`** in server components/actions; `createBrowserClient` in client components
- **`cookies()` and `headers()` must be awaited** in Next.js 16
- **`params` in page/route props must be awaited** in Next.js 16
- **Zod v4**: `.issues` not `.errors` on ZodError
- **Model:** `claude-sonnet-4-6` — no exceptions
- **`ANTHROPIC_API_KEY`** lives in Supabase Edge Function secrets only — but Phase 4 draft generation runs from a Next.js App Router route handler, not an Edge Function (see Architecture section for why and where the key goes)
- **Tiptap JSON** (not HTML) is the storage format — locked decision from project inception

### Conventions

- Route protection lives in `src/proxy.ts` + re-exported from `src/middleware.ts`
- Admin client (`service_role`) is for webhook handlers only — Phase 4 API routes use `createServerClient` with session cookies
- Subscription gating: `isSubscriptionActive()` from `src/lib/billing/subscription-check.ts`
- RLS: `(select auth.uid()) = user_id` (cached form)

---

## Standard Stack

### Core (Phase 4 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/react` | 2.27.2 | React integration — `useEditor`, `EditorContent` | Required for React binding |
| `@tiptap/starter-kit` | 2.27.2 | Heading, Paragraph, Bold, Italic, BulletList, OrderedList, Code, Blockquote, HardBreak, HorizontalRule, History | Bundles all basic marks/nodes |
| `@tiptap/extension-underline` | 2.27.2 | Underline mark — not in StarterKit | EDITOR-01 requires underline |
| `@tiptap/extension-table` | 2.27.2 | Table node | EDITOR-01 requires tables |
| `@tiptap/extension-table-row` | 2.27.2 | TableRow node (peer dep of extension-table) | Required by extension-table |
| `@tiptap/extension-table-header` | 2.27.2 | TableHeader node | Required by extension-table |
| `@tiptap/extension-table-cell` | 2.27.2 | TableCell node | Required by extension-table |
| `@tiptap/pm` | 2.27.2 | ProseMirror bindings (shared peer dep) | Required across all Tiptap v2 packages |
| `@anthropic-ai/sdk` | 0.80.0 | Claude API — already installed as devDep, promote to dep | Already present — move from devDependencies |

**Note on `@anthropic-ai/sdk` placement:** Currently a `devDependency` from Phase 3 (Edge Functions). Phase 4 draft API routes run in Next.js App Router (Node.js), not Deno, so the SDK must be a production `dependency`.

### Version Verification

Verified 2026-03-23 via `npm view` against registry:
- `@tiptap/react@2` — v2-latest dist-tag = `2.27.2`
- All `@tiptap/*@2` packages use synchronized versioning — install same version across all

### No New Supporting Libraries Needed

| Problem | Do NOT add | Use instead |
|---------|-----------|-------------|
| Streaming | `ai` (Vercel AI SDK v6) | Raw `@anthropic-ai/sdk` `.stream()` + `ReadableStream` |
| Debounce | `lodash` | `useRef` + `setTimeout`/`clearTimeout` (already in React 19) |
| Markdown parsing | `marked`, `remark` | `editor.commands.setContent(html)` with Tiptap's built-in HTML parser, or direct JSON construction |

### Installation

```bash
npm install @tiptap/react@2.27.2 @tiptap/starter-kit@2.27.2 @tiptap/extension-underline@2.27.2 @tiptap/extension-table@2.27.2 @tiptap/extension-table-row@2.27.2 @tiptap/extension-table-header@2.27.2 @tiptap/extension-table-cell@2.27.2 @tiptap/pm@2.27.2
```

And move Anthropic SDK from devDependencies to dependencies in package.json.

---

## Architecture Patterns

### Recommended File Structure (Phase 4 additions)

```
src/
  app/
    (dashboard)/
      proposals/
        [id]/
          editor/
            page.tsx              # Server component: load proposal + rfp_analysis + profile
          editor/
            loading.tsx           # Suspense fallback for editor shell
    api/
      proposals/
        [id]/
          draft/
            route.ts              # POST: stream one section from Claude
          sections/
            route.ts              # GET all sections, PATCH one section (upsert)
  components/
    editor/
      ProposalEditor.tsx          # 'use client' — root editor component with section tabs
      SectionEditor.tsx           # 'use client' — single Tiptap instance per section
      EditorToolbar.tsx           # 'use client' — formatting controls
      CompliancePanel.tsx         # 'use client' — compliance matrix sidebar with live coverage
      RegenerateDialog.tsx        # 'use client' — modal with optional instruction input
  lib/
    editor/
      extensions.ts               # Shared extension array (StarterKit + Underline + Table + ComplianceGap)
      compliance-gap-mark.ts      # Custom Tiptap Mark extension for highlighting
      compliance-scanner.ts       # Pure function: scan TiptapJSON for requirement keyword coverage
      draft-prompts.ts            # Per-section prompt builders — inject profile, requirements
supabase/
  migrations/
    00004_proposal_sections.sql   # proposal_sections table
```

### Pattern 1: Tiptap v2 Editor Initialization

The `useEditor` hook must only run in a Client Component (`'use client'`). All extensions must be imported from the version-pinned packages.

```typescript
// Source: Tiptap v2 documentation + npm:@tiptap/react@2.27.2
// src/lib/editor/extensions.ts
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ComplianceGapMark } from './compliance-gap-mark'

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  ComplianceGapMark,
]
```

```typescript
// src/components/editor/SectionEditor.tsx
'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from '@/lib/editor/extensions'
import type { JSONContent } from '@tiptap/react'

interface SectionEditorProps {
  initialContent: JSONContent | null
  onUpdate: (json: JSONContent) => void
}

export function SectionEditor({ initialContent, onUpdate }: SectionEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent ?? '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
  })

  return <EditorContent editor={editor} />
}
```

**Critical:** `useEditor` returns `null` on the first render (SSR). Always guard: `if (!editor) return null`.

### Pattern 2: Streaming Route Handler (Claude → Browser)

The ANTHROPIC_API_KEY must move to the Next.js App Router environment for Phase 4. The Edge Function path (Supabase) is correct for background jobs (Phase 3), but interactive streaming requires a direct route handler in Next.js.

```typescript
// Source: @anthropic-ai/sdk@0.80.0 MessageStream.toReadableStream()
// src/app/api/proposals/[id]/draft/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { isSubscriptionActive } from '@/lib/billing/subscription-check'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(/* ... */)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // subscription gate
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()
  if (!isSubscriptionActive(profile?.subscription_status ?? null, profile?.trial_ends_at ?? null)) {
    return new Response('Payment required', { status: 402 })
  }

  const { section, instruction } = await request.json()

  // Build prompt (see draft-prompts.ts)
  const systemPrompt = await buildSectionPrompt(supabase, proposalId, user.id, section, instruction)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Draft the ${section} section now.` }],
  })

  // Convert MessageStream to Web ReadableStream and return directly
  return new Response(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

**Critical:** `ANTHROPIC_API_KEY` must be added to `.env.local` (and Vercel environment variables in production) for the Next.js route handler. This is SEPARATE from the Supabase Edge Function secret used in Phase 3. Both values are the same key — they are configured in two different places.

### Pattern 3: Client-side Stream Reading and Editor Injection

**The trap:** calling `editor.commands.insertContent(chunk)` on every SSE chunk triggers a ProseMirror transaction per chunk. With 100+ chunks per section, the editor freezes.

**The fix:** accumulate the full text as a string, then call `editor.commands.setContent()` once the stream ends. For progressive "typing" effect: update a separate React state string and only write to editor on completion.

```typescript
// src/components/editor/SectionEditor.tsx  — regenerate handler
async function handleRegenerate(section: string, instruction?: string) {
  setIsStreaming(true)
  setStreamBuffer('')

  const response = await fetch(`/api/proposals/${proposalId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, instruction }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    // Parse SSE events — Anthropic SDK emits SSE format
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            fullText += event.delta.text
            setStreamBuffer(fullText) // display in UI as text preview
          }
        } catch { /* ignore malformed lines */ }
      }
    }
  }

  // Write complete content to editor in ONE transaction
  if (editor && fullText) {
    editor.commands.setContent(`<p>${fullText.replace(/\n\n/g, '</p><p>')}</p>`)
  }
  setIsStreaming(false)
}
```

**Better approach for structured content:** Have Claude return Markdown, then convert via `editor.commands.setContent(markdownContent)` — Tiptap v2's `StarterKit` includes a built-in Markdown input rule handler. Or accept HTML from the prompt and call `editor.commands.setContent(htmlString)`.

### Pattern 4: Auto-Save (EDITOR-02)

30-second interval auto-save. Do NOT use `onUpdate` + debounce for this — `onUpdate` fires on every keystroke and will create too many Supabase requests. Use a separate `setInterval` that reads the current editor JSON.

```typescript
// src/components/editor/SectionEditor.tsx — auto-save
const editorRef = useRef(editor)
editorRef.current = editor

useEffect(() => {
  const interval = setInterval(async () => {
    if (!editorRef.current || !isDirty) return
    const json = editorRef.current.getJSON()
    await saveSectionContent(proposalId, section, json)
    setLastSavedAt(new Date())
    setIsDirty(false)
  }, 30_000)
  return () => clearInterval(interval)
}, [proposalId, section, isDirty])
```

The `lastSavedAt` state feeds a "Saved at HH:MM" display in the toolbar. Mark `isDirty = true` in the `onUpdate` callback; reset to `false` after save.

### Pattern 5: Custom Tiptap Mark — ComplianceGap (EDITOR-04)

Custom marks are defined by extending `Mark` from `@tiptap/core`. A `ComplianceGap` mark wraps paragraph spans where required keywords are absent.

```typescript
// Source: Tiptap v2 custom extension docs
// src/lib/editor/compliance-gap-mark.ts
import { Mark } from '@tiptap/core'

export const ComplianceGapMark = Mark.create({
  name: 'complianceGap',

  addAttributes() {
    return {
      requirementId: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-compliance-gap]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', {
      ...HTMLAttributes,
      'data-compliance-gap': HTMLAttributes.requirementId,
      class: 'compliance-gap',
      style: 'background-color: rgba(251, 191, 36, 0.3); border-bottom: 2px solid #F59E0B;',
    }, 0]
  },
})
```

**Applying marks programmatically:**
```typescript
// After computing which requirement keywords are absent in this section:
editor.chain()
  .setTextSelection({ from: paragraphStart, to: paragraphEnd })
  .setMark('complianceGap', { requirementId: req.id })
  .run()
```

**CRITICAL for Phase 5:** Strip `complianceGap` marks before exporting. Filter them from the Tiptap JSON before passing to the Word/PDF export functions:
```typescript
function stripComplianceMarks(json: JSONContent): JSONContent {
  // Recursively remove marks with type === 'complianceGap'
}
```

### Pattern 6: Compliance Scanner (EDITOR-03)

Coverage status updates run client-side after each auto-save. The scanner reads `editor.getJSON()` and checks if requirement keywords appear in the section text.

```typescript
// src/lib/editor/compliance-scanner.ts
import type { JSONContent } from '@tiptap/react'
import type { ComplianceMatrixRow, AnalysisRequirement } from '@/lib/analysis/types'

function extractText(json: JSONContent): string {
  if (json.text) return json.text
  return (json.content ?? []).map(extractText).join(' ')
}

export function scanCompliance(
  sectionJson: JSONContent,
  requirements: AnalysisRequirement[],
  sectionName: string
): Map<string, 'addressed' | 'partial' | 'unaddressed'> {
  const sectionText = extractText(sectionJson).toLowerCase()
  const result = new Map<string, 'addressed' | 'partial' | 'unaddressed'>()

  for (const req of requirements.filter(r => r.proposal_topic === sectionName)) {
    // Extract key nouns from requirement text — simple keyword heuristic
    const keywords = req.text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []
    const matchCount = keywords.filter(kw => sectionText.includes(kw)).length
    const coverage = matchCount / Math.max(keywords.length, 1)
    result.set(req.id, coverage >= 0.6 ? 'addressed' : coverage >= 0.3 ? 'partial' : 'unaddressed')
  }

  return result
}
```

### Pattern 7: Database Schema — proposal_sections

One row per (proposal_id, section_name). Content stored as Tiptap JSON in a `jsonb` column.

```sql
-- supabase/migrations/00004_proposal_sections.sql
create table public.proposal_sections (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  section_name    text not null
    check (section_name in (
      'Executive Summary',
      'Technical Approach',
      'Management Plan',
      'Past Performance',
      'Price Narrative'
    )),
  content         jsonb not null default '{"type":"doc","content":[]}',
  draft_status    text not null default 'empty'
    check (draft_status in ('empty', 'generating', 'draft', 'edited')),
  last_saved_at   timestamptz,
  tokens_used     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (proposal_id, section_name)
);

alter table public.proposal_sections enable row level security;

create policy "Users can manage own proposal_sections"
  on proposal_sections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index on proposal_sections (proposal_id);
create index on proposal_sections (user_id);
```

**Upsert pattern:**
```typescript
await supabase.from('proposal_sections').upsert({
  proposal_id: proposalId,
  user_id: userId,
  section_name: section,
  content: editorJson,
  last_saved_at: new Date().toISOString(),
  draft_status: 'edited',
}, { onConflict: 'proposal_id,section_name' })
```

### Pattern 8: Profile Injection for Draft Prompts

Each section prompt receives the full profile context. RFP text is cached on the second system block (same pattern as Phase 3).

```typescript
// src/lib/editor/draft-prompts.ts — example for Executive Summary
export async function buildExecutiveSummaryPrompt(
  profile: Profile,
  pastProjects: PastProject[],
  keyPersonnel: KeyPersonnel[],
  rfpText: string,
  requirements: AnalysisRequirement[],
  instruction?: string
): Promise<Anthropic.MessageParam['content']> {
  const execReqs = requirements
    .filter(r => r.proposal_topic === 'Technical' || r.proposal_topic === 'Certifications')
    .map(r => `- ${r.text.slice(0, 150)}`)
    .join('\n')

  return [
    {
      type: 'text',
      text: `You are a federal proposal writer. Draft a compelling Executive Summary.

Contractor: ${profile.company_name}
Certifications: ${(profile.certifications ?? []).join(', ')}
NAICS Codes: ${(profile.naics_codes ?? []).join(', ')}
Capability Statement: ${profile.capability_statement}

Key Personnel:
${keyPersonnel.map(p => `- ${p.name}, ${p.title}: ${p.experience?.slice(0, 200)}`).join('\n')}

Past Projects (most relevant):
${pastProjects.slice(0, 5).map(p => `- ${p.agency}: ${p.scope_narrative?.slice(0, 300)}`).join('\n')}

Key requirements this section must address:
${execReqs}

${instruction ? `Special instruction: ${instruction}` : ''}

Write 3-4 paragraphs. Use clear headings. Reference specific certifications and past performance.`,
    },
    {
      type: 'text',
      text: `FULL RFP TEXT:\n\n${rfpText}`,
      cache_control: { type: 'ephemeral' } as const,
    },
  ]
}
```

**Prompt caching:** The `rfp_text` block gets `cache_control: ephemeral`. If all five sections are generated in sequence within the cache window, calls 2–5 hit the cache, saving ~47% per call (matches Phase 3 cost model).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing | Custom contenteditable | Tiptap v2 + StarterKit | ProseMirror history, undo/redo, selection, table editing are 10,000+ lines of edge-case handling |
| SSE parsing | Custom `EventSource` / manual parser | Browser `ReadableStream` with `TextDecoder` | `EventSource` does not support POST requests — must use `fetch` + manual chunk reading |
| Streaming integration | Vercel AI SDK (`useChat`, `useCompletion`) | Raw `@anthropic-ai/sdk` streams | AI SDK v6 `@ai-sdk/anthropic` does not support `cache_control` on system blocks — would break prompt caching established in Phase 3 |
| Custom mark CSS | Inline style per mark | CSS class via `renderHTML` + Tailwind | CSS class allows toggling visibility for export |
| Markdown-to-Tiptap | `marked` + manual AST walk | `editor.commands.setContent(html)` | Tiptap v2 StarterKit parses HTML directly via `parseHTML` rules on each extension |

---

## Common Pitfalls

### Pitfall 1: Tiptap v3 API Leakage
**What goes wrong:** The `latest` dist-tag on npm for all `@tiptap/*` packages resolves to `3.20.4`. Installing without `@2` suffix installs v3, which has breaking changes (different import paths, different extension API, different `useEditor` hook signature).
**Why it happens:** `npm install @tiptap/react` gets v3. Project requires v2.
**How to avoid:** Always pin `@tiptap/react@2.27.2` etc. with explicit version in `package.json`. Run `npm ls @tiptap/react` to verify.
**Warning signs:** `useEditor` returns different type signature; `EditorContent` is imported differently.

### Pitfall 2: ProseMirror Transaction Flood During Streaming
**What goes wrong:** Calling `editor.commands.insertContent(delta)` on every SSE chunk (potentially 300+ events for a 1000-word section) causes one ProseMirror transaction + re-render per chunk. The editor becomes unresponsive.
**Why it happens:** `insertContent` is a full transaction — it's meant for user-initiated inserts.
**How to avoid:** Accumulate the full streamed text in a React state string, then call `editor.commands.setContent()` exactly once when the stream closes.
**Warning signs:** Editor freezes or lags during generation; browser dev tools show hundreds of synchronous renders.

### Pitfall 3: useEditor SSR Crash
**What goes wrong:** `useEditor` throws on the server or returns `null` unexpectedly, crashing the component.
**Why it happens:** `useEditor` uses browser APIs (ProseMirror DOM). If rendered in an RSC or without `'use client'`, it throws. On first client render it returns `null`.
**How to avoid:** (a) Add `'use client'` to every component that calls `useEditor`. (b) Guard every `editor` usage: `if (!editor) return <LoadingShell />`.
**Warning signs:** Hydration mismatch errors; "document is not defined" server error.

### Pitfall 4: ComplianceGap Mark Leaking into Export
**What goes wrong:** Phase 5 export reads Tiptap JSON directly. If `complianceGap` marks are present, they appear as `<span data-compliance-gap>` in the Word/PDF export.
**Why it happens:** Marks persist in `getJSON()` output by design.
**How to avoid:** Build `stripComplianceMarks(json: JSONContent): JSONContent` in Phase 4 and export it. Phase 5 MUST call this before any export conversion.
**Warning signs:** Yellow highlights appearing in exported Word/PDF.

### Pitfall 5: Supabase Auto-Save Race Condition
**What goes wrong:** Two saves fire simultaneously (one from 30s interval, one from tab-close `beforeunload`). The second save overwrites the first using stale data.
**Why it happens:** The interval and `beforeunload` both read `editor.getJSON()` and both call upsert.
**How to avoid:** Use a `isSaving` ref flag. Check and set atomically before initiating save. The Supabase upsert on `(proposal_id, section_name)` is idempotent, so the worst case is a duplicate save with the same content.
**Warning signs:** "Saved at" timestamp jumps backward; content reverts after save.

### Pitfall 6: ANTHROPIC_API_KEY Dual Configuration
**What goes wrong:** Developer adds the key only to Supabase Edge Function secrets (as in Phase 3) and not to `.env.local`. The Next.js draft route handler returns 500 because `process.env.ANTHROPIC_API_KEY` is undefined.
**Why it happens:** Phase 3 deliberately kept the key out of `.env.local`. Phase 4 adds a new consumer (App Router route handler) that needs the key in Next.js environment.
**How to avoid:** Add `ANTHROPIC_API_KEY` to `.env.local` and update `.env.local.example`. Document that this key now exists in both places.
**Warning signs:** Draft generation API returns 500; `new Anthropic()` throws "Missing API key".

### Pitfall 7: Compliance Scanner Running Too Frequently
**What goes wrong:** Compliance scanner runs on every editor `onUpdate` (every keystroke). For a 200-requirement compliance matrix, this is O(200 * textLength) work per keystroke.
**Why it happens:** Naive wiring of `onUpdate` → `scanCompliance`.
**How to avoid:** Run compliance scan only after auto-save (30s interval), not on every keystroke. This matches the requirement: "updates coverage status as the user edits" — interpreted as per save cycle, not per keystroke.
**Warning signs:** CPU pegs at 100% while typing in editor.

---

## Code Examples

### Tiptap v2 StarterKit What's Included

StarterKit (verified from `@tiptap/starter-kit@2.27.2` source) bundles:
- Nodes: Blockquote, BulletList, CodeBlock, Document, HardBreak, Heading, HorizontalRule, ListItem, OrderedList, Paragraph, Text
- Marks: Bold, Code, Italic, Strike
- Extensions: Dropcursor, Gapcursor, History

**Not in StarterKit** (must install separately): Underline, Table/TableRow/TableHeader/TableCell, Link, Image, Highlight, Color

### Tiptap JSON Format (storage target)

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Executive Summary" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "HCC provides " },
        { "type": "text", "marks": [{ "type": "bold" }], "text": "certified" },
        { "type": "text", "text": " construction management." }
      ]
    }
  ]
}
```

This is the format stored in `proposal_sections.content` (jsonb column).

### Anthropic SDK Streaming (App Router route)

The SDK's `messages.stream()` returns a `MessageStream` with a `.toReadableStream()` method that emits SSE-formatted events:

```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Draft "}}
```

The client reads these with `fetch` + `response.body.getReader()` and filters for `content_block_delta` / `text_delta` events.

### Route Handler — Params Await Pattern (Next.js 16)

```typescript
// Source: Next.js 16 docs — node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // params is a Promise in Next.js 16
) {
  const { id } = await params  // MUST await params
  ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tiptap v3 | Tiptap v2 (pinned by project) | v3 released ~2024 | v3 has different extension API — project is locked to v2 |
| Vercel AI SDK for streaming | Raw Anthropic SDK + ReadableStream | AI SDK v4+ | AI SDK doesn't support `cache_control` on system blocks; raw SDK required for prompt caching |
| `editor.commands.insertContent()` per chunk | Buffer full text, `setContent()` once | Performance issue identified 2024 | Prevents ProseMirror transaction flood |
| Decoration API for highlights | Custom Mark extension | Tiptap v2 best practice | Decorations are ephemeral; Marks persist in JSON and can be queried/removed programmatically |

---

## Open Questions

1. **Streaming partial Markdown rendering**
   - What we know: Claude will produce Markdown (headers with `##`, bullets with `-`). Accumulating as plain text and calling `setContent()` at end works correctly via Tiptap's HTML parser.
   - What's unclear: Whether to ask Claude to return HTML directly vs. Markdown. HTML is more deterministic for Tiptap but harder to prompt for. Markdown is natural but requires parsing.
   - Recommendation: Prompt Claude to return HTML fragments (`<h2>`, `<p>`, `<ul>`) — Tiptap's `parseHTML` rules on each extension handle this correctly. Test with one section before generalizing.

2. **ComplianceGap mark scope: paragraph vs. sentence**
   - What we know: Marking full paragraphs is simple but may highlight large text blocks.
   - What's unclear: Whether paragraph-level highlighting is precise enough for users to act on.
   - Recommendation: Start with paragraph-level highlighting (simpler ProseMirror position tracking). Upgrade to sentence-level in a future iteration if user feedback indicates it's too coarse.

3. **proposal_sections or extend proposals JSONB**
   - What we know: Could store all sections as `sections: jsonb` on the `proposals` row, or use a separate `proposal_sections` table with one row per section.
   - Recommendation: Separate table. Allows RLS per section in the future, cleaner upsert semantics, and better query performance for Phase 5 export (load one section at a time).

---

## Environment Availability

All Phase 4 dependencies are available in the existing environment. No new external services are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js App Router route handler | Yes | 24.x (confirmed from Phase 2 notes) | — |
| npm registry | Tiptap v2 packages | Yes | Verified via `npm view` | — |
| `@anthropic-ai/sdk` | Draft API route | Yes (devDep) | 0.80.0 | Promote to dep |
| Supabase | proposal_sections table upsert | Yes | Running (Phase 1-3 used it) | — |
| ANTHROPIC_API_KEY in .env.local | Draft API route | Needs addition | — | Add to .env.local |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` in `.env.local` — must be added before Phase 4 draft routes work. Currently only configured as a Supabase Edge Function secret.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists from Phase 1) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |
| E2E | `npx playwright test --project=chromium` (requires running dev server) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAFT-01 | Executive Summary prompt injects certifications, capability statement, past projects | Unit | `npx vitest run tests/drafting/draft-prompts.test.ts` | No — Wave 0 |
| DRAFT-02 | Technical Approach prompt includes RFP technical requirements | Unit | `npx vitest run tests/drafting/draft-prompts.test.ts` | No — Wave 0 |
| DRAFT-03 | Management Plan prompt includes key personnel bios | Unit | `npx vitest run tests/drafting/draft-prompts.test.ts` | No — Wave 0 |
| DRAFT-04 | Past Performance prompt includes matched past projects | Unit | `npx vitest run tests/drafting/draft-prompts.test.ts` | No — Wave 0 |
| DRAFT-05 | Price Narrative prompt excludes any dollar amounts | Unit | `npx vitest run tests/drafting/draft-prompts.test.ts` | No — Wave 0 |
| DRAFT-06 | Regenerate route accepts instruction string in POST body | Unit (route) | `npx vitest run tests/drafting/draft-route.test.ts` | No — Wave 0 |
| EDITOR-01 | StarterKit + Underline + Table extensions registered | Unit | `npx vitest run tests/editor/extensions.test.ts` | No — Wave 0 |
| EDITOR-02 | Auto-save fires after 30s; Supabase upsert called with correct JSON | Unit (timer mock) | `npx vitest run tests/editor/auto-save.test.ts` | No — Wave 0 |
| EDITOR-03 | Compliance scanner returns 'addressed' when keywords present | Unit | `npx vitest run tests/editor/compliance-scanner.test.ts` | No — Wave 0 |
| EDITOR-04 | ComplianceGap mark renders with correct class; stripped from export JSON | Unit | `npx vitest run tests/editor/compliance-gap-mark.test.ts` | No — Wave 0 |

**E2E tests (Playwright — require running server):**
- Generate a section and verify it appears in editor (DRAFT-01 through DRAFT-05 end-to-end)
- Edit content, wait 30s, verify "Saved at" timestamp appears (EDITOR-02 end-to-end)
- Edit to add a requirement keyword, verify compliance status updates to "addressed" (EDITOR-03 end-to-end)

These E2E tests are integration-heavy and should only be run in the phase gate — not per-commit.

### What Can Be Unit Tested (Vitest, no running server needed)

- `draft-prompts.ts` — All five prompt builders: verify certifications array appears in output, past projects appear, key personnel appear. Mock the Supabase data.
- `compliance-scanner.ts` — Pure function. Given a Tiptap JSON doc and a requirements array, returns correct coverage map. Test: addressed when 60%+ keywords present; unaddressed when absent; partial in between.
- `compliance-gap-mark.ts` — Extension creation (structure check — does it have the right name and attributes).
- `draft-route.ts` — Route handler unit test: verify auth check, subscription check (402 on inactive), correct `section` param propagation. Mock Anthropic SDK to avoid real API calls.
- `auto-save.ts` — Timer logic: use `vi.useFakeTimers()` to advance 30 seconds and verify `saveSectionContent` was called.

### What Requires E2E Only

- Actual editor rendering (Tiptap requires a browser DOM)
- Stream injection into editor (requires live ReadableStream from browser fetch)
- Visual compliance highlighting (requires rendered editor with ProseMirror DOM)
- End-to-end generation flow (requires Anthropic API)

### Wave 0 Gaps

- [ ] `tests/drafting/draft-prompts.test.ts` — covers DRAFT-01 through DRAFT-05 prompt injection
- [ ] `tests/drafting/draft-route.test.ts` — covers DRAFT-06 route auth/subscription gating
- [ ] `tests/editor/extensions.test.ts` — covers EDITOR-01 extension registration
- [ ] `tests/editor/auto-save.test.ts` — covers EDITOR-02 timer behavior
- [ ] `tests/editor/compliance-scanner.test.ts` — covers EDITOR-03 keyword scanning
- [ ] `tests/editor/compliance-gap-mark.test.ts` — covers EDITOR-04 mark creation + strip
- [ ] `supabase/migrations/00004_proposal_sections.sql` — new table required before any section save works
- [ ] `ANTHROPIC_API_KEY` added to `.env.local` — blocks all draft generation tests that hit the real API

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@tiptap/react@2.27.2` — version verified via `npm view @tiptap/react dist-tags` (v2-latest = 2.27.2)
- `node_modules/@anthropic-ai/sdk@0.80.0` — `MessageStream.toReadableStream()` verified in `src/lib/MessageStream.ts` line 736
- `node_modules/@anthropic-ai/sdk@0.80.0` — Streaming event types verified in `src/resources/messages/messages.ts`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — `params: Promise<{...}>` pattern confirmed
- `supabase/migrations/00001_foundation_schema.sql` — proposals table structure confirmed
- `supabase/migrations/00002_document_ingestion.sql` — proposals table extensions confirmed
- `supabase/migrations/00003_rfp_analysis.sql` — rfp_analysis table confirmed (compliance_matrix available for editor)
- `CLAUDE.md` — Stack constraints and conventions verified
- `package.json` — current installed dependencies verified

### Secondary (MEDIUM confidence)

- Tiptap v2 StarterKit contents — inferred from extension pattern; extension list is stable across 2.x releases
- ProseMirror transaction flood pitfall — well-documented community pattern for streaming-into-editor scenarios

### Tertiary (LOW confidence)

- HTML vs Markdown prompt strategy for Claude output — recommendation based on Tiptap parsing behavior; needs empirical validation with actual Claude output

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified from npm registry; SDK APIs verified from installed source
- Architecture: HIGH — patterns derived from existing Phase 3 code + verified SDK APIs
- Pitfalls: HIGH — Tiptap version trap verified from dist-tags; ProseMirror transaction flood is documented; others derived from existing codebase patterns
- Prompt design: MEDIUM — structure is sound; exact prompt text requires iteration with real Claude output

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (Tiptap v2 stable; Anthropic SDK stable for streaming API; Next.js 16 stable)
