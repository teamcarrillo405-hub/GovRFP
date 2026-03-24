---
phase: 03
name: RFP Analysis
created: 2026-03-23
requirements: [ANALYZE-01, ANALYZE-02, ANALYZE-03, ANALYZE-04, ANALYZE-05]
confidence: HIGH
---

# Phase 3: RFP Analysis — Research

**Researched:** 2026-03-23
**Domain:** Claude API (tool_use, prompt caching), async job queues, JSONB data modeling, FAR Part 15 document structure, win probability algorithms
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANALYZE-01 | Extract every shall/must/will statement; classify mandatory vs desired; verbatim source citation (section + page) | Claude tool_use with strict:true + 1M-token context window; Phase 2 already extracted raw requirements via regex — Claude deepens/classifies them |
| ANALYZE-02 | Compliance matrix mapping each requirement to a proposal section with coverage status | Second Claude tool call using extracted requirements; maps to standard FAR proposal sections; stored as JSONB array |
| ANALYZE-03 | Win probability score (0-100) with 5-factor breakdown | Hybrid: 2 factors computed algorithmically (certs, set-aside); 3 factors from Claude semantic reasoning (scope, past performance, competition) |
| ANALYZE-04 | Detect set-aside preferences; flag match against contractor certifications | Regex on rfp_text for program keywords + comparison against profiles.certifications array — no LLM needed |
| ANALYZE-05 | Section L/M crosswalk table | Third Claude tool call; regex pre-detection of L/M blocks; Claude maps instructions to criteria |
</phase_requirements>

---

## Summary

Phase 3 is the core AI intelligence layer of HCC ProposalAI. It takes the cleaned `rfp_text` and `rfp_structure` from Phase 2 and produces four structured outputs: a deep requirements extraction (ANALYZE-01), a compliance matrix (ANALYZE-02), a win probability score with reasoned breakdown (ANALYZE-03), and a Section L/M crosswalk (ANALYZE-05). Set-aside detection (ANALYZE-04) is entirely algorithmic — no LLM required — using regex against `rfp_text` and a direct array comparison with `profiles.certifications`.

The most important architectural discovery is the model capability jump: **claude-sonnet-4-6 now has a 1M-token context window** (verified March 2026 against official docs). A typical 50-page government RFP is 25,000–75,000 tokens — well under the 1M limit and under the Sonnet 4.6 64K max output limit. This means all five analysis tasks can run in a small number of sequential API calls against the full document, with no chunking, no pagination, and no multi-step aggregation. This dramatically simplifies the architecture versus what would have been required with a 200K context window.

The second critical insight is **prompt caching economics**. The `rfp_text` (the 50-page document) is 25,000–75,000 tokens per analysis job. Without caching, running 3 Claude calls against the same document costs 3x the full input price. With a single `cache_control: {type: "ephemeral"}` marker on the system block containing the document, subsequent calls read the document from cache at 0.1x base price. For Sonnet 4.6 at $3/MTok base, cached reads are $0.30/MTok — a 10x reduction. With a 50K token RFP and 3 calls, caching saves approximately $0.30 per analysis job (from ~$0.45 to ~$0.15 in input costs alone). Over 1,000 analyses/month, that is $300/month savings.

The third key decision is the **tool_use / structured output pattern**. Claude's new `strict: true` tool mode guarantees the response matches the declared JSON schema exactly — no parsing failures, no retry logic needed. This is the correct choice for production extraction of typed arrays (requirements, matrix rows, score factors, crosswalk entries). The alternative — JSON mode via `output_config.format` — is also valid and slightly simpler to implement, but `strict: true` tool_use is more explicit about schema and better for IDE tooling.

**Primary recommendation:** Add `analysis_jobs` as a new job type in the existing `document_jobs` table (using a `job_type` column). Trigger analysis automatically when a document job completes. Run all Claude calls in a new `analyze-proposal` Supabase Edge Function. Store results in a single new `rfp_analysis` table (Option B from the open questions) with JSONB columns. Gate analysis behind `isSubscriptionActive()` at the API route that queues the job.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Framework:** Next.js 16.2.1 — `proxy.ts`, awaited `cookies()`, awaited `params`
- **Auth:** `@supabase/ssr` 0.9.0 — never `@supabase/auth-helpers-nextjs`; `getUser()` not `getSession()`
- **AI:** Claude API only — `claude-sonnet-4-6` primary, `claude-opus-4-6` for complex reasoning
- **Prompt caching required from first API call** — uncached full-RFP at $3/MTok destroys margin (CLAUDE.md explicit directive)
- **Subscription gating:** `isSubscriptionActive()` in `src/lib/billing/subscription-check.ts` — all AI routes gated
- **Edge Function pattern:** Deno runtime; imports via `npm:` specifier; service-role client only; never expose ANTHROPIC_API_KEY to browser
- **Zod v4:** `parsed.error.issues` not `parsed.error.errors`
- **No custom middleware** — re-export `proxy.ts` from `middleware.ts`
- **Vercel bundle limit:** 250MB compressed — `@anthropic-ai/sdk` not installed in Next.js app; used only in Edge Function via `npm:@anthropic-ai/sdk`
- **TypeScript strict** — no implicit any, no non-null assertions without guards

---

## 1. Claude API Integration

### Model Specifications (verified 2026-03-23, official docs)

| Property | claude-sonnet-4-6 | claude-opus-4-6 |
|----------|-------------------|-----------------|
| Context window | **1M tokens** | 1M tokens |
| Max output tokens | **64K tokens** | 128K tokens |
| Input cost (uncached) | $3.00 / MTok | $5.00 / MTok |
| Output cost | $15.00 / MTok | $25.00 / MTok |
| Cache write cost (5 min) | $3.75 / MTok (1.25x) | $6.25 / MTok |
| Cache write cost (1 hr) | $6.00 / MTok (2x) | $10.00 / MTok |
| Cache read cost | **$0.30 / MTok (0.1x)** | $0.50 / MTok |
| Min cache token threshold | **2,048 tokens** | 4,096 tokens |

**Context window determination:** A 50-page government RFP is approximately 25,000–75,000 tokens (rough: 1 page ≈ 500–1,500 tokens depending on table-heavy content). Even a 200-page solicitation fits in the 1M window. No chunking required. This is confirmed HIGH confidence from official Anthropic model docs.

### Deno Edge Function Import Pattern

The `@anthropic-ai/sdk` package is Node-centric but supports Deno via `npm:` specifier. The pattern mirrors how Phase 2 imports `npm:mammoth` and `npm:unpdf`.

```typescript
// supabase/functions/analyze-proposal/index.ts
import Anthropic from 'npm:@anthropic-ai/sdk@0.80.0'

const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
})
```

**Alternative: raw fetch.** The Anthropic REST API is simple enough that a raw `fetch()` call with SigV4-style `x-api-key` header works (same pattern as Phase 2's Textract implementation). The SDK is preferred because it handles retry logic, error parsing, and the `cache_control` header correctly. The SDK adds ~2MB to the Deno bundle (not a concern — Edge Functions have no Vercel bundle limit, only 256MB memory).

### Prompt Caching Implementation

The RFP document is the stable "corpus" for all three analysis calls. Cache it once; all subsequent calls read from cache. The Sonnet 4.6 minimum is 2,048 tokens — any real RFP exceeds this.

**Strategy: System block caching (explicit breakpoints)**

Place `cache_control: {type: "ephemeral"}` on the **last system block** that contains the full `rfp_text`. Each subsequent call in the same analysis job will hit the cache because the system block is identical.

```typescript
// Source: Anthropic official docs (platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  system: [
    {
      type: 'text',
      text: 'You are an expert federal proposal analyst...',
      // No cache_control here — this is short and changes per call type
    },
    {
      type: 'text',
      text: `FULL RFP TEXT:\n\n${rfpText}`,
      cache_control: { type: 'ephemeral' },  // Cache the document
      // TTL defaults to 5 minutes; use { type: 'ephemeral', ttl: '1h' } if calls
      // are spread across a longer workflow
    },
  ],
  tools: [extractionTool],
  tool_choice: { type: 'tool', name: 'extract_requirements' },
  messages: [
    { role: 'user', content: 'Extract all requirements from this RFP.' },
  ],
})
```

**5-minute TTL is sufficient** because all 3 analysis calls for a single proposal happen within seconds of each other (sequential within one Edge Function invocation). Use `ttl: '1h'` only if calls are spread across separate invocations.

**Cache hit verification:** Check `response.usage.cache_read_input_tokens > 0` after the second call. Log this in the Edge Function for cost monitoring.

### Token Budget and Cost Per Analysis

Assumptions: 50-page RFP, ~50,000 tokens.

| Call | Purpose | Input tokens | Output tokens | Cached? | Cost (est.) |
|------|---------|-------------|---------------|---------|-------------|
| Call 1 | Requirements extraction | 50,000 (write) + 500 prompt | 3,000 | Cache miss (write) | $0.153 in + $0.045 out = **$0.198** |
| Call 2 | Compliance matrix | 50,000 (read) + 800 prompt + 3,000 prior output | 2,000 | Cache HIT | $0.016 in + $0.030 out = **$0.046** |
| Call 3 | Win probability + L/M crosswalk | 50,000 (read) + 1,000 prompt + 5,000 prior | 2,500 | Cache HIT | $0.017 in + $0.038 out = **$0.055** |
| **Total (with caching)** | | | | | **~$0.30 per analysis** |
| **Total (no caching)** | | 3 × 50,500 = 151,500 | ~7,500 | None | **~$0.57 per analysis** |

**Savings from caching: ~47% reduction in API cost per analysis.**

At $29/month per user, the platform can sustain approximately 90 analyses/month per user before AI costs alone exceed subscription revenue. At $0.30 per analysis, the realistic budget is 90 analyses/month at breakeven — well above typical contractor behavior (2–5 proposals/month × 1 re-analysis each = 5–10 API calls/month).

---

## 2. Structured Extraction Strategy

### Recommended: Strict Tool Use (tool_choice forced)

Use `strict: true` + `tool_choice: {type: "tool", name: "..."}` for all structured extraction. This guarantees the output matches the declared JSON schema — no retry on parse failure, no defensive `try/catch` around JSON.parse.

**Why not `output_config.format` (JSON mode)?** Both work. `strict: true` tool_use is preferred because:
1. It makes the schema explicit in code (IDE autocomplete + type inference)
2. The tool definition doubles as documentation for the planner
3. Claude's tool_use path is better-tested for complex nested arrays
4. Forcing a specific tool name makes the intent unambiguous

**Why not system-prompt JSON guidance?** Unreliable for complex nested structures. Claude may wrap the JSON in markdown fences, add commentary, or deviate from the schema under unusual RFP content. Strict tool_use eliminates all of these failure modes.

### Call Architecture: 3 Sequential Calls, Same Edge Function

```
analyze-proposal Edge Function invocation
│
├── Step 0: Load data
│   ├── Fetch proposals row (rfp_text, rfp_structure)
│   ├── Fetch profiles row (certifications, naics_codes, capability_statement)
│   └── Fetch past_projects rows (for scope/past-perf context)
│
├── Step 1: Requirements Extraction (ANALYZE-01)
│   └── Claude call: extract_requirements tool
│       Input: full rfp_text (cached), rfp_structure.sections for section refs
│       Output: RfpRequirement[] with verbatim text, classification, section, page_hint
│
├── Step 2: Compliance Matrix (ANALYZE-02) + Section L/M (ANALYZE-05)
│   └── Claude call: build_compliance_matrix tool
│       Input: rfp_text (cached hit), extracted requirements from Step 1, standard_proposal_sections
│       Output: ComplianceMatrixRow[] + SectionLMCrosswalk[]
│       (Combining steps 2+5 saves one cache write)
│
├── Step 3: Win Probability (ANALYZE-03)
│   ├── Algorithmic factors (computed locally, no LLM):
│   │   ├── certifications_match: profiles.certifications ∩ rfp_set_asides → 0-100
│   │   └── set_aside_match: boolean flag → contributes to score
│   └── Claude call: score_win_probability tool
│       Input: rfp_text (cached hit), capability_statement, past_projects[], scope_summary from Step 1
│       Claude evaluates: scope_alignment (0-100), past_performance_relevance (0-100), competition_level (0-100) with reasoning
│       Final score: weighted average of all 5 factors
│
├── Step 4: Set-aside detection (ANALYZE-04)
│   └── Algorithmic (regex on rfp_text) — no LLM call needed
│
└── Step 5: Write results to rfp_analysis table, update proposals.status = 'analyzed'
```

### Tool Definitions

**Tool 1 — extract_requirements:**
```typescript
// Source pattern: Anthropic strict tool_use docs
{
  name: 'extract_requirements',
  description: 'Extract all mandatory and desired requirements from a federal RFP',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Sequential ID: REQ-001, REQ-002...' },
            text: { type: 'string', description: 'Verbatim text of the requirement sentence' },
            classification: { type: 'string', enum: ['mandatory', 'desired'] },
            keyword: { type: 'string', enum: ['shall', 'must', 'will', 'should', 'may'] },
            section_ref: { type: 'string', description: 'Section number or letter (e.g., L.4.2)' },
            page_hint: { type: 'string', description: 'Page reference if visible in text (e.g., "p. 12")' },
            proposal_topic: { type: 'string', description: 'Topic area: Technical, Management, Past Performance, Price, Certifications, Deliverables, Other' },
          },
          required: ['id', 'text', 'classification', 'keyword', 'section_ref', 'proposal_topic'],
          additionalProperties: false,
        },
      },
      set_asides_detected: {
        type: 'array',
        items: { type: 'string' },
        description: 'Set-aside programs mentioned: 8(a), HUBZone, SDVOSB, WOSB, SDB, VOSB, etc.',
      },
      contract_type: {
        type: 'string',
        description: 'Detected contract type: IDIQ, BPA, GWAC, FFP, CPFF, T&M, etc. or "Unknown"',
      },
      naics_code: {
        type: 'string',
        description: 'Primary NAICS code if identified in the RFP, or empty string',
      },
    },
    required: ['requirements', 'set_asides_detected', 'contract_type', 'naics_code'],
    additionalProperties: false,
  },
}
```

**Tool 2 — build_compliance_matrix:**
```typescript
{
  name: 'build_compliance_matrix',
  description: 'Map RFP requirements to proposal sections and identify Section L/M crosswalk',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      compliance_matrix: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            requirement_id: { type: 'string' },
            proposal_section: { type: 'string', description: 'Target proposal section: Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative, Cover Letter, Other' },
            coverage_status: { type: 'string', enum: ['addressed', 'unaddressed', 'partial'] },
            rationale: { type: 'string', description: 'One sentence explaining the mapping' },
          },
          required: ['requirement_id', 'proposal_section', 'coverage_status', 'rationale'],
          additionalProperties: false,
        },
      },
      section_lm_crosswalk: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_l_ref: { type: 'string', description: 'Section L instruction reference (e.g., L.4.1)' },
            section_l_instruction: { type: 'string', description: 'Verbatim or paraphrased Section L instruction' },
            section_m_ref: { type: 'string', description: 'Corresponding Section M criterion reference' },
            section_m_criterion: { type: 'string', description: 'Verbatim or paraphrased evaluation criterion' },
            weight: { type: 'string', description: 'Relative weight or importance if stated (e.g., "Most Important", "Equal", or "Not specified")' },
          },
          required: ['section_l_ref', 'section_l_instruction', 'section_m_ref', 'section_m_criterion', 'weight'],
          additionalProperties: false,
        },
      },
      has_section_l: { type: 'boolean' },
      has_section_m: { type: 'boolean' },
    },
    required: ['compliance_matrix', 'section_lm_crosswalk', 'has_section_l', 'has_section_m'],
    additionalProperties: false,
  },
}
```

**Tool 3 — score_win_probability:**
```typescript
{
  name: 'score_win_probability',
  description: 'Evaluate win probability factors requiring semantic analysis',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      scope_alignment: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100' },
          reasoning: { type: 'string' },
          gaps: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning', 'gaps'],
        additionalProperties: false,
      },
      past_performance_relevance: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100' },
          reasoning: { type: 'string' },
          matching_projects: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning', 'matching_projects'],
        additionalProperties: false,
      },
      competition_level: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100 where 100 = low competition (good)' },
          reasoning: { type: 'string' },
          indicators: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning', 'indicators'],
        additionalProperties: false,
      },
    },
    required: ['scope_alignment', 'past_performance_relevance', 'competition_level'],
    additionalProperties: false,
  },
}
```

---

## 3. Win Probability Algorithm

### Factor Design: Hybrid Computed + Claude

ANALYZE-03 requires 5 factors. Two can be computed purely from data; three require semantic analysis.

| Factor | Method | Data Source | Notes |
|--------|--------|-------------|-------|
| scope_alignment | Claude | rfp_text + capability_statement + past_project.scope_narratives | How closely contractor's stated capabilities match the RFP's technical scope |
| certifications_match | **Computed** | rfp_text set-asides + profiles.certifications[] | Array intersection — no LLM |
| set_aside_match | **Computed** | rfp_text set-aside type + profiles.certifications[] | Boolean → maps to 0 or 100 |
| past_performance_relevance | Claude | rfp_text + past_projects[].scope_narrative + naics_code | Semantic similarity between contractor history and solicitation requirements |
| competition_level | Claude | rfp_text | RFP language signals about expected competition: small business pools, agency history, NAICS specificity, page-count/complexity, number of required volumes |

### Score Weighting

```typescript
const WEIGHTS = {
  scope_alignment: 0.30,
  certifications_match: 0.20,
  set_aside_match: 0.20,         // 20 points if set-aside matches; 0 if no match or no set-aside
  past_performance_relevance: 0.20,
  competition_level: 0.10,
}

function computeWinScore(factors: WinFactors): number {
  return Math.round(
    factors.scope_alignment.score * WEIGHTS.scope_alignment +
    factors.certifications_match * WEIGHTS.certifications_match +
    factors.set_aside_match * WEIGHTS.set_aside_match +
    factors.past_performance_relevance.score * WEIGHTS.past_performance_relevance +
    factors.competition_level.score * WEIGHTS.competition_level
  )
}
```

### Certifications Match (Computed)

```typescript
// profiles.certifications = ['8(a)', 'SDB']
// rfp_set_asides_detected = ['8(a)', 'HUBZone']

function computeCertificationsScore(
  contractorCerts: string[],
  rfpSetAsides: string[]
): number {
  if (rfpSetAsides.length === 0) return 50  // No preference stated — neutral
  const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const certSet = new Set(contractorCerts.map(normalized))
  const matches = rfpSetAsides.filter(sa => certSet.has(normalized(sa)))
  return matches.length > 0 ? 90 : 20  // Strong advantage vs. ineligible
}

function computeSetAsideScore(
  contractorCerts: string[],
  rfpSetAsideType: string | null
): number {
  if (!rfpSetAsideType) return 50  // Full and open — neutral
  const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const certSet = new Set(contractorCerts.map(normalized))
  return certSet.has(normalized(rfpSetAsideType)) ? 100 : 0
}
```

---

## 4. Set-aside Detection (ANALYZE-04)

### Regex Patterns (Algorithmic, No LLM)

Federal RFP set-aside language is highly standardized (FAR Part 19). These regex patterns are reliable for the Uniform Contract Format.

```typescript
// Confidence: HIGH — FAR Part 19 language is mandated; agencies use standard FAR clauses

const SET_ASIDE_PATTERNS: Record<string, RegExp> = {
  '8(a)':    /\b8\s*\(a\)\b|\b8a\s+(?:set[-\s]aside|program|contract|small\s+business)\b/i,
  'HUBZone': /\bhubzone\b|\bhistorically\s+underutilized\s+business\s+zone\b/i,
  'SDVOSB':  /\bsdvosb\b|\bservice[-\s]disabled\s+veteran[-\s]owned\s+small\s+business\b/i,
  'VOSB':    /\bvosb\b|\bveteran[-\s]owned\s+small\s+business\b/i,
  'WOSB':    /\bwosb\b|\bwomen[-\s]owned\s+small\s+business\b/i,
  'EDWOSB':  /\bedwosb\b|\beconomically\s+disadvantaged\s+women[-\s]owned\b/i,
  'SDB':     /\bsdb\b|\bsmall\s+disadvantaged\s+business\b/i,
  'SBSA':    /\bsmall\s+business\s+set[-\s]aside\b|\btotal\s+small\s+business\b/i,
}

function detectSetAsides(rfpText: string): string[] {
  return Object.entries(SET_ASIDE_PATTERNS)
    .filter(([, pattern]) => pattern.test(rfpText))
    .map(([name]) => name)
}

function detectPrimarySetAside(rfpText: string): string | null {
  // FAR 52.219-* clause numbers indicate the set-aside type
  const clauseMap: Record<string, string> = {
    '52.219-14': 'SBSA',
    '52.219-3':  'HUBZone',
    '52.219-27': 'SDVOSB',
    '52.219-29': 'EDWOSB',
    '52.219-30': 'WOSB',
  }
  for (const [clause, type] of Object.entries(clauseMap)) {
    if (new RegExp(clause.replace('.', '\\.')).test(rfpText)) return type
  }
  // Fallback: first match from SET_ASIDE_PATTERNS
  return detectSetAsides(rfpText)[0] ?? null
}
```

**Flag generation:**
```typescript
function generateSetAsideFlags(
  rfpText: string,
  contractorCerts: string[]
): SetAsideFlag[] {
  const detected = detectSetAsides(rfpText)
  return detected.map(sa => ({
    program: sa,
    detected_in_rfp: true,
    contractor_eligible: contractorCerts
      .map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .includes(sa.toLowerCase().replace(/[^a-z0-9]/g, '')),
    is_match: contractorCerts
      .map(c => c.toLowerCase())
      .some(c => c.includes(sa.toLowerCase())),
  }))
}
```

---

## 5. Section L/M Detection

### What Section L and M Are

Section L = "Instructions, Conditions, and Notices to Offerors" — tells contractors what to write in their proposal (volume structure, page limits, content requirements per section).

Section M = "Evaluation Criteria" — tells evaluators how to score proposals (criteria, weights, tradeoffs).

**Scope of Section L/M:** They exist **only in FAR Part 15 competitive negotiations** (the Uniform Contract Format, FAR 15.204-1). They do NOT appear in:
- FAR Part 13 (simplified acquisition — uses SF-18/SF-1449 forms)
- FAR Part 14 (sealed bidding — uses Invitation for Bids)
- Task orders under an existing IDIQ/GWAC (may have SOW but no formal L/M)
- GSA Schedule orders (use quotation process, not proposals)

**Detection approach:** Regex to identify whether the document is FAR Part 15 format. If L/M not detected, populate `has_section_l: false, has_section_m: false` and return an empty crosswalk. Claude should flag this to the user.

### Regex Patterns

```typescript
// Uniform Contract Format section headers
// FAR 15.204-1 mandates these exact labels or close variations

const SECTION_L_PATTERNS = [
  /SECTION\s+L[\s.:–—]/i,
  /SEC(?:TION)?\.?\s+L[\s.:–—]/i,
  /PART\s+(?:IV|4).*SECTION\s+L/is,
  /L\.\s+(?:INSTRUCTIONS?|CONDITIONS?|NOTICES?)\s+TO\s+OFFERORS?/i,
  /INSTRUCTIONS?,?\s+CONDITIONS?\s+AND\s+NOTICES?\s+TO\s+OFFERORS?/i,
  /PROPOSAL\s+PREPARATION\s+INSTRUCTIONS?/i,
]

const SECTION_M_PATTERNS = [
  /SECTION\s+M[\s.:–—]/i,
  /SEC(?:TION)?\.?\s+M[\s.:–—]/i,
  /M\.\s+EVALUATION\s+(?:FACTORS?|CRITERIA)/i,
  /EVALUATION\s+FACTORS?\s+FOR\s+AWARD/i,
  /BASIS\s+FOR\s+AWARD/i,
  /EVALUATION\s+CRITERIA/i,
]

function detectSectionLM(rfpText: string): { hasL: boolean; hasM: boolean } {
  const hasL = SECTION_L_PATTERNS.some(p => p.test(rfpText))
  const hasM = SECTION_M_PATTERNS.some(p => p.test(rfpText))
  return { hasL, hasM }
}
```

**Non-FAR-15 handling:** When `has_section_l = false`, the compliance matrix still runs (ANALYZE-02), but the crosswalk table (ANALYZE-05) returns empty with a note: `"This solicitation does not appear to use the Uniform Contract Format (FAR 15.204-1). Section L/M crosswalk is not applicable. Requirements were extracted directly from the Statement of Work and attachments."` This is surfaced in the UI as an informational notice, not an error.

---

## 6. Data Model

### Recommended: Option B — Single `rfp_analysis` Table

**Rationale:**
- Option A (columns on `proposals`) makes `proposals` a fat table that grows with every phase. By Phase 4, `proposals` would have 20+ columns including JSONB blobs. This is harder to query and harder to reason about.
- Option C (multiple tables) is appropriate when you need to query individual rows of the matrix or join on requirement IDs. Phase 4 (compliance live-link in editor) WILL need to query individual requirements by ID — but it can do so from a JSONB index, not a normalized table. The Phase 4 need does not justify the normalization overhead in Phase 3.
- Option B provides clean separation, one row per proposal, and JSONB columns that are trivially indexable by Postgres GIN index for Phase 4's text-search needs.

### Schema: `00003_rfp_analysis.sql`

```sql
-- rfp_analysis table: one row per proposal, holds all Phase 3 outputs
create table public.rfp_analysis (
  id                    uuid primary key default gen_random_uuid(),
  proposal_id           uuid not null unique references public.proposals(id) on delete cascade,
  user_id               uuid not null references auth.users on delete cascade,

  -- ANALYZE-01: Extracted requirements
  requirements          jsonb not null default '[]',
  -- Structure: RfpRequirement[] — see TypeScript types below

  -- ANALYZE-02: Compliance matrix
  compliance_matrix     jsonb not null default '[]',
  -- Structure: ComplianceMatrixRow[]

  -- ANALYZE-03: Win probability
  win_score             integer check (win_score >= 0 and win_score <= 100),
  win_factors           jsonb,
  -- Structure: WinFactors (scope_alignment, certifications_match, set_aside_match,
  --            past_performance_relevance, competition_level — each with score + reasoning)

  -- ANALYZE-04: Set-aside detection
  set_asides_detected   text[] default '{}',
  set_aside_flags       jsonb default '[]',
  -- Structure: SetAsideFlag[] — program, detected_in_rfp, contractor_eligible, is_match

  -- ANALYZE-05: Section L/M crosswalk
  section_lm_crosswalk  jsonb not null default '[]',
  has_section_l         boolean default false,
  has_section_m         boolean default false,

  -- Metadata
  analyzed_at           timestamptz not null default now(),
  model_used            text not null default 'claude-sonnet-4-6',
  tokens_input          integer,
  tokens_output         integer,
  tokens_cached         integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.rfp_analysis enable row level security;

create policy "Users can view own rfp_analysis"
  on rfp_analysis for select to authenticated
  using ((select auth.uid()) = user_id);

-- GIN indexes for JSONB querying (Phase 4 needs: find requirement by ID)
create index on rfp_analysis using gin(requirements);
create index on rfp_analysis using gin(compliance_matrix);
create index on rfp_analysis (proposal_id);
create index on rfp_analysis (user_id);

-- Update proposals.status to include 'analyzed'
alter table public.proposals
  drop constraint proposals_status_check;

alter table public.proposals
  add constraint proposals_status_check
  check (status in ('draft', 'processing', 'ready', 'analyzed', 'archived'));
```

### TypeScript Types (`src/lib/analysis/types.ts`)

```typescript
export interface RfpRequirement {
  id: string                  // REQ-001, REQ-002...
  text: string                // Verbatim
  classification: 'mandatory' | 'desired'
  keyword: 'shall' | 'must' | 'will' | 'should' | 'may'
  section_ref: string
  page_hint?: string
  proposal_topic: 'Technical' | 'Management' | 'Past Performance' | 'Price' | 'Certifications' | 'Deliverables' | 'Other'
}

export interface ComplianceMatrixRow {
  requirement_id: string
  proposal_section: 'Executive Summary' | 'Technical Approach' | 'Management Plan' | 'Past Performance' | 'Price Narrative' | 'Cover Letter' | 'Other'
  coverage_status: 'addressed' | 'unaddressed' | 'partial'
  rationale: string
}

export interface WinFactorDetail {
  score: number               // 0-100
  reasoning: string
  gaps?: string[]
  matching_projects?: string[]
  indicators?: string[]
}

export interface WinFactors {
  scope_alignment: WinFactorDetail
  certifications_match: number  // Computed — just a score, no reasoning object needed
  set_aside_match: number       // Computed — 0 or 100
  past_performance_relevance: WinFactorDetail
  competition_level: WinFactorDetail
}

export interface SetAsideFlag {
  program: string
  detected_in_rfp: boolean
  contractor_eligible: boolean
  is_match: boolean
}

export interface SectionLMEntry {
  section_l_ref: string
  section_l_instruction: string
  section_m_ref: string
  section_m_criterion: string
  weight: string
}

export interface RfpAnalysis {
  id: string
  proposal_id: string
  requirements: RfpRequirement[]
  compliance_matrix: ComplianceMatrixRow[]
  win_score: number
  win_factors: WinFactors
  set_asides_detected: string[]
  set_aside_flags: SetAsideFlag[]
  section_lm_crosswalk: SectionLMEntry[]
  has_section_l: boolean
  has_section_m: boolean
  analyzed_at: string
  model_used: string
}
```

---

## 7. Job Queue Architecture

### Decision: Extend `document_jobs` Table with `job_type` Column

**Rationale:** Adding a `job_type` column to `document_jobs` reuses the proven atomic claim pattern (`claim_next_document_job()` → updated to `claim_next_job()`), the pg_cron schedule, and the Realtime subscription already in Phase 2. The alternative (separate `analysis_jobs` table) duplicates all queue infrastructure for no benefit at the MVP scale.

**Migration change:**
```sql
-- In 00003_rfp_analysis.sql
alter table public.document_jobs
  add column job_type text not null default 'document'
    check (job_type in ('document', 'analysis'));

-- New claim function that handles both job types (replaces old function)
create or replace function public.claim_next_job(p_job_type text default 'document')
returns setof public.document_jobs
language plpgsql security definer as $$
begin
  return query
  update public.document_jobs
  set status = 'processing', started_at = now(), updated_at = now()
  where id = (
    select id from public.document_jobs
    where status = 'pending' and job_type = p_job_type
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;
```

**Automatic trigger:** When a `document` job completes with `status = 'completed'`, insert an `analysis` job with `job_type = 'analysis'` for the same `proposal_id`. This happens inside the `process-documents` Edge Function, after writing `rfp_text` and before returning.

```typescript
// At end of process-documents/index.ts success path:
await supabase.from('document_jobs').insert({
  proposal_id: job.proposal_id,
  user_id: job.user_id,
  storage_path: job.storage_path,   // Same path — analysis reads rfp_text, not storage
  file_type: job.file_type,
  job_type: 'analysis',
  status: 'pending',
})
```

**Separate Edge Function:** Analysis runs in `supabase/functions/analyze-proposal/index.ts` — separate from `process-documents`. This keeps each function under the 256MB memory ceiling and allows independent scaling if needed. pg_cron already calls `process-documents`; a second pg_cron entry calls `analyze-proposal` on the same 60-second schedule.

**Subscription gate:** At job creation time (inside `process-documents`), verify subscription before enqueuing analysis:

```typescript
// In process-documents/index.ts, before inserting analysis job:
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_status, trial_ends_at')
  .eq('id', job.user_id)
  .single()

const { isSubscriptionActive } = await import('npm:@YOUR_PKG/subscription-check')
// Note: isSubscriptionActive() is defined in src/lib/billing/ — cannot import from Edge Function
// Replicate the logic inline or extract to a shared module.
// Logic: active | trialing (and trial not expired) = allow; else skip analysis

const isActive =
  profile?.subscription_status === 'active' ||
  (profile?.subscription_status === 'trialing' &&
   new Date(profile.trial_ends_at ?? 0) > new Date())

if (!isActive) {
  // Do not queue analysis job — user is not subscribed
  // Update proposals status to 'ready' without analysis
  return
}
```

**Realtime:** The existing `ProcessingStatus.tsx` component already subscribes to `document_jobs` Postgres Changes. It will automatically surface the `analysis` job status (processing/completed/failed) with no UI changes needed — the same status badge shows "Analyzing..." when `job_type = 'analysis'` and `status = 'processing'`. A new status value for `proposals.status = 'analyzed'` is the canonical "analysis complete" signal.

---

## 8. File Structure

New files required for Phase 3:

```
src/
  app/
    (dashboard)/
      proposals/
        [id]/
          analysis/
            page.tsx              # Analysis results page: compliance matrix + win score + L/M crosswalk
  api/
    analysis/
      trigger/
        route.ts                  # POST: manually re-trigger analysis (subscription gated)
  components/
    analysis/
      ComplianceMatrix.tsx        # Client component: requirements table with coverage badges
      WinScoreCard.tsx            # Client component: score gauge + factor breakdown
      SetAsideFlags.tsx           # Client component: matched/unmatched set-aside badges
      SectionLMCrosswalk.tsx      # Client component: L/M table
  lib/
    analysis/
      types.ts                    # TypeScript types for all analysis outputs
      set-aside-detector.ts       # detectSetAsides(), detectPrimarySetAside(), generateSetAsideFlags()
      win-score.ts                # computeWinScore(), computeCertificationsScore(), computeSetAsideScore()
      section-lm-detector.ts      # detectSectionLM() — regex on rfp_text

supabase/
  migrations/
    00003_rfp_analysis.sql        # rfp_analysis table + RLS + GIN indexes + job_type column
  functions/
    analyze-proposal/
      index.ts                    # Deno Edge Function: claim analysis job → 3 Claude calls → write results

tests/
  analysis/
    set-aside-detector.test.ts    # ANALYZE-04 — regex patterns against known RFP text
    win-score.test.ts             # ANALYZE-03 computed factors
    section-lm-detector.test.ts   # ANALYZE-05 — Section L/M regex detection
    analysis-job-queue.test.ts    # Job queue extension (job_type column)
    rfp-analysis-schema.test.ts   # DB schema validation for rfp_analysis table
```

**Files NOT in Next.js app (Edge Function only):**
```
supabase/functions/analyze-proposal/index.ts
```
This file cannot import from `src/` — Deno cannot resolve Next.js path aliases. All shared logic (set-aside detection, win scoring) must be either duplicated inline or extracted to a Deno-compatible module. The recommended approach: keep the pure TypeScript utility functions in `src/lib/analysis/` (for Node/Vitest testing) AND duplicate the core logic inline in the Edge Function (same as Phase 2's `extractRfpStructure` pattern).

---

## 9. Common Pitfalls

### Pitfall 1: Cache Key Invalidation on Proposal Re-analysis
**What goes wrong:** User re-analyzes a proposal after editing the RFP (re-upload). The `rfp_text` changes, so the cache key changes. The first call of the new analysis hits a cache miss (expected), but if the developer passes `cache_control` on the wrong block (e.g., the prompt instructions instead of the document), every call misses the cache.
**Why it happens:** `cache_control` must be on the **last block that is stable within a session** — the document block. The instructions block changes between Call 1/2/3 (different prompts), so it must NOT carry `cache_control`.
**How to avoid:** Always put `cache_control` on the system block that contains `rfp_text` only. The instructions system block must be a separate array entry without `cache_control`.

### Pitfall 2: Strict Tool Use Fails on Large Output Arrays
**What goes wrong:** Claude returns a `tool_use` block that is valid JSON but exceeds `max_tokens`. The response is truncated mid-JSON, causing a parse error even with `strict: true` (strict validates schema conformance, not completeness).
**Why it happens:** A 200-requirement RFP can produce a `requirements` array that approaches 8,000–12,000 tokens as JSON. If `max_tokens` is too low, Claude truncates.
**How to avoid:** Set `max_tokens: 16000` for Call 1 (requirements extraction). Sonnet 4.6 supports 64K max output — there is no reason to use a low value. Monitor `stop_reason: 'max_tokens'` in the response and fail the job with an error if triggered.

### Pitfall 3: Section L/M Regex False Negatives on Non-Standard Formats
**What goes wrong:** Some agencies (DoD, VA, DoE) use Section L/M labels but format them as "SECTION L — Instructions" on one line, or embed them in a cover table with cell content "L. Proposal Preparation Instructions". The regex misses the header and `has_section_l = false` is returned, skipping the crosswalk entirely.
**Why it happens:** The UCF format is required but the typographic presentation varies.
**How to avoid:** Use the multiple SECTION_L_PATTERNS array (defined above) with 6 variations. Pass `has_section_l` and `has_section_m` to Claude in the compliance matrix call, so if regex misses them, Claude can still detect L/M content in context and report them correctly.

### Pitfall 4: `claim_next_document_job()` Function Name Conflict
**What goes wrong:** The migration adds `job_type` column and renames the claim function to `claim_next_job()`. But the existing Phase 2 Edge Function (`process-documents/index.ts`) still calls `claim_next_document_job()`. After migration, `process-documents` fails silently — the old function name no longer exists.
**Why it happens:** Database migrations are applied, but deployed Edge Functions are not automatically updated.
**How to avoid:** The migration must retain `claim_next_document_job()` as an alias (or the old function modified to call the new one with `p_job_type = 'document'`). Alternatively, keep the original function name and add a new `claim_next_analysis_job()`. The plan must explicitly update `process-documents/index.ts` to call the correct function.

### Pitfall 5: ANTHROPIC_API_KEY Not Set as Edge Function Secret
**What goes wrong:** `Deno.env.get('ANTHROPIC_API_KEY')` returns `undefined`. The Anthropic client constructor throws. The analysis job fails with an unclear error.
**Why it happens:** Supabase Edge Function secrets are set separately from the project `.env`. Developers who set up `.env.local` forget to add it to the Edge Function secrets in the dashboard.
**How to avoid:** Document in the migration plan that `ANTHROPIC_API_KEY` must be added via Supabase Dashboard > Edge Functions > Secrets or via `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`.

---

## 10. Validation Architecture

### Test Framework (existing — Phase 1/2 established)

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |
| E2E | `npx playwright test` (requires running dev server) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANALYZE-01 | Requirements extracted with correct classification and verbatim text | unit | `npx vitest run tests/analysis/set-aside-detector.test.ts` | Wave 0 |
| ANALYZE-02 | Compliance matrix maps requirements to proposal sections | unit (schema + structure validation) | `npx vitest run tests/analysis/rfp-analysis-schema.test.ts` | Wave 0 |
| ANALYZE-03 | Win score computed correctly from factor inputs | unit | `npx vitest run tests/analysis/win-score.test.ts` | Wave 0 |
| ANALYZE-04 | Set-aside detection catches all 7 program types + generates match flags | unit | `npx vitest run tests/analysis/set-aside-detector.test.ts` | Wave 0 |
| ANALYZE-05 | Section L/M regex detects UCF format; returns empty gracefully for non-UCF | unit | `npx vitest run tests/analysis/section-lm-detector.test.ts` | Wave 0 |
| Job queue | analysis job_type queued after document job completes | unit (migration structural) | `npx vitest run tests/analysis/analysis-job-queue.test.ts` | Wave 0 |

**Note on Claude API calls in tests:** Unit tests do NOT call the live Claude API. The Claude-dependent logic (requirements extraction, compliance matrix, win factor scoring) is tested by:
1. Defining the expected tool schema shape (TypeScript type validation)
2. Testing the downstream computation (win score from given factor inputs)
3. Testing error handling (missing fields, invalid scores)
4. Integration testing with a mock Anthropic client (vitest.mock)

Live Claude API calls are tested via a manual E2E smoke test: upload a known RFP fixture, wait for analysis job completion, verify `rfp_analysis` row exists with non-empty `requirements` array. This is documented but not automated (requires live Supabase + ANTHROPIC_API_KEY in CI — not available).

### Sampling Rate
- **Per task commit:** `npx vitest run tests/analysis/`
- **Per wave merge:** `npx vitest run` (full 69+ tests)
- **Phase gate:** Full suite green + manual analysis smoke test before `/gsd:verify-work`

### Wave 0 Gaps (test files to create)
- [ ] `tests/analysis/set-aside-detector.test.ts` — covers ANALYZE-01, ANALYZE-04
- [ ] `tests/analysis/win-score.test.ts` — covers ANALYZE-03 computed factors
- [ ] `tests/analysis/section-lm-detector.test.ts` — covers ANALYZE-05 regex detection
- [ ] `tests/analysis/analysis-job-queue.test.ts` — covers job_type extension
- [ ] `tests/analysis/rfp-analysis-schema.test.ts` — covers migration structural validation

---

## 11. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, Vitest | Yes | 20.x (from Phase 2) | — |
| Supabase CLI | Migrations, Edge Functions | Yes (assumed — Phase 2 used it) | — | — |
| `@anthropic-ai/sdk` | Edge Function | Not yet in package.json | 0.80.0 (verified npm) | Raw fetch to Anthropic REST API |
| ANTHROPIC_API_KEY | analyze-proposal Edge Function | Not yet set | — | None — analysis blocked without it |
| pg_cron (Supabase) | Second cron job for analyze-proposal | Yes (from Phase 2) | — | Manual HTTP invocation |

**Missing dependencies:**
- `@anthropic-ai/sdk` is NOT in `package.json`. Required only as `npm:@anthropic-ai/sdk@0.80.0` in the Edge Function — no Node.js install needed. However, TypeScript types are useful during development: add `@anthropic-ai/sdk` to `devDependencies` for type checking.
- `ANTHROPIC_API_KEY` must be set in Supabase Edge Function secrets before analysis jobs can run.

---

## 12. Top 3 Risks

### Risk 1: Claude Output Exceeds max_tokens Mid-Array
**Probability:** Medium (uncommon for standard RFPs; likely for 100+ requirement solicitations)
**Impact:** High — truncated JSON causes analysis job to fail; user sees "Analysis failed" with no explanation
**Mitigation:**
1. Set `max_tokens: 16000` for requirements extraction (Sonnet 4.6 supports 64K output)
2. Check `stop_reason` — if `'max_tokens'`, retry with `max_tokens: 32000`
3. If RFP has > 100 requirements, batch in two calls: first 60 pages, last pages (only needed for genuinely large RFPs)
4. Add `stop_reason` to the analysis metadata stored in `rfp_analysis`

### Risk 2: 5-Minute Cache TTL Expires Between Calls (Slow Edge Functions)
**Probability:** Low — all 3 calls are sequential within one function invocation, taking < 60 seconds total
**Impact:** Medium — cache miss on calls 2/3 increases cost by ~$0.20 per analysis; not functionally broken
**Mitigation:** Use `ttl: '1h'` for the first analysis of a given proposal. For re-analysis (user manually triggers again), use default 5-minute TTL (the second run will also be sequential within one invocation).

### Risk 3: `claim_next_document_job()` Function Name Collision During Migration
**Probability:** High if not handled explicitly
**Impact:** High — Phase 2 process-documents Edge Function silently fails after migration because old function is replaced by `claim_next_job()`
**Mitigation:** Retain backward-compatible alias in the migration:
```sql
-- Keep old function name as alias for deployed process-documents Edge Function
create or replace function public.claim_next_document_job()
returns setof public.document_jobs
language plpgsql security definer as $$
begin return query select * from claim_next_job('document'); end; $$;
```

---

## Sources

### Primary (HIGH confidence)
- Official Anthropic docs (platform.claude.com/docs/en/docs/about-claude/models) — claude-sonnet-4-6 context window (1M), pricing, max output
- Official Anthropic docs (platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) — cache_control placement, TTL options, cache pricing (0.1x), minimum token threshold (2048 for Sonnet 4.6)
- Official Anthropic docs (platform.claude.com/docs/en/docs/build-with-claude/structured-outputs) — strict: true tool_use, output_config.format, JSON mode vs tool_use comparison
- npm registry (npm view @anthropic-ai/sdk version) — confirmed 0.80.0 latest
- Project source code inspection — `supabase/migrations/00001_foundation_schema.sql`, `00002_document_ingestion.sql`, `supabase/functions/process-documents/index.ts`, `package.json`
- FAR Part 15 (acquisition.gov/far/part-15) — Uniform Contract Format sections A–M, Section L/M scope

### Secondary (MEDIUM confidence)
- SmallGovCon.com article on federal solicitation sections — confirmed A–M structure, L/M labels
- FAR Part 19 (acquisition.gov/far/part-19) — set-aside program definitions, FAR 52.219-* clause numbers
- Supabase blog (supabase.com/blog/processing-large-jobs-with-edge-functions) — job queue single-table pattern confirmation
- Supabase docs (supabase.com/docs/guides/functions/dependencies) — `npm:` specifier for Deno imports

### Tertiary (LOW confidence — not relied upon)
- WebSearch results on win probability scoring algorithms — no authoritative source found; algorithm is therefore designed from first principles based on the 5 factors specified in REQUIREMENTS.md

---

## Metadata

**Confidence breakdown:**
- Claude API integration: HIGH — verified directly against official Anthropic docs (March 2026)
- Prompt caching: HIGH — official docs with code examples; minimum threshold and cost verified
- Strict tool_use: HIGH — official structured outputs docs
- Data model: HIGH — based on actual schema inspection of Phases 1 and 2
- Set-aside detection regex: HIGH — FAR Part 19 clause language is standardized
- Section L/M detection: MEDIUM — UCF format is required by FAR but typographic variation is real; 6 patterns mitigate most cases
- Win probability algorithm: MEDIUM — factor design from REQUIREMENTS.md specification; weights are judgment calls with no industry benchmark (no authoritative source found)
- Job queue extension: HIGH — same pattern as Phase 2, confirmed by source code inspection

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (model pricing and context window stable; prompt caching API stable)
