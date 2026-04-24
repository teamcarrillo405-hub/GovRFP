// Supabase Edge Function — runs on Deno runtime
// Triggered by pg_cron (every 60s) or HTTP invoke
// Claims and processes one pending analysis job per invocation
// Runs 3 sequential Claude API calls with prompt caching on rfp_text block

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.80.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisJob {
  id: string
  proposal_id: string
  user_id: string
  storage_path: string
  file_type: 'pdf' | 'docx'
  job_type: string
  status: string
}

// =============================================================================
// Inline: Set-aside detection
// Duplicated from src/lib/analysis/set-aside-detector.ts — Deno cannot import from src/
// Keep these in sync if patterns change.
// =============================================================================

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
    .filter(([, p]) => p.test(rfpText))
    .map(([name]) => name)
}

function detectPrimarySetAside(rfpText: string): string | null {
  for (const [name, pattern] of Object.entries(SET_ASIDE_PATTERNS)) {
    if (pattern.test(rfpText)) return name
  }
  return null
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function generateSetAsideFlags(
  rfpText: string,
  contractorCerts: string[]
): Array<{ program: string; detected_in_rfp: boolean; contractor_eligible: boolean; is_match: boolean }> {
  const detectedPrograms = detectSetAsides(rfpText)
  const certSet = new Set(contractorCerts.map(normalizeStr))
  return detectedPrograms.map(program => ({
    program,
    detected_in_rfp: true,
    contractor_eligible: certSet.has(normalizeStr(program)),
    is_match: certSet.has(normalizeStr(program)),
  }))
}

// =============================================================================
// Inline: Section L/M detection
// Duplicated from src/lib/analysis/section-lm-detector.ts — Deno cannot import from src/
// Keep these in sync if patterns change.
// =============================================================================

const SECTION_L_PATTERNS = [
  /SECTION\s+L[\s.:–—]/i,
  /L\.\s+(?:INSTRUCTIONS?|CONDITIONS?)\s+TO\s+OFFERORS?/i,
  /INSTRUCTIONS?,?\s+CONDITIONS?\s+AND\s+NOTICES?\s+TO\s+OFFERORS?/i,
  /PROPOSAL\s+PREPARATION\s+INSTRUCTIONS?/i,
]
const SECTION_M_PATTERNS = [
  /SECTION\s+M[\s.:–—]/i,
  /M\.\s+EVALUATION\s+(?:FACTORS?|CRITERIA)/i,
  /EVALUATION\s+FACTORS?\s+FOR\s+AWARD/i,
  /BASIS\s+FOR\s+AWARD/i,
]

function detectSectionLM(text: string): { hasL: boolean; hasM: boolean } {
  return {
    hasL: SECTION_L_PATTERNS.some(p => p.test(text)),
    hasM: SECTION_M_PATTERNS.some(p => p.test(text)),
  }
}

// =============================================================================
// Inline: Win score computation
// Duplicated from src/lib/analysis/win-score.ts — Deno cannot import from src/
// Keep these in sync if weights change.
// =============================================================================

const WIN_WEIGHTS = {
  scope: 0.30,
  certs: 0.25,
  setaside: 0.20,
  perf: 0.15,
  competition: 0.10,
} as const

function computeCertificationsScore(contractorCerts: string[], rfpSetAsides: string[]): number {
  if (rfpSetAsides.length === 0) return 50
  const certSet = new Set(contractorCerts.map(normalizeStr))
  const matches = rfpSetAsides.filter(sa => certSet.has(normalizeStr(sa)))
  return matches.length > 0 ? 90 : 20
}

function computeSetAsideScore(contractorCerts: string[], primarySetAside: string | null): number {
  if (!primarySetAside) return 50
  const certSet = new Set(contractorCerts.map(normalizeStr))
  return certSet.has(normalizeStr(primarySetAside)) ? 100 : 0
}

function computeWinScore(winFactors: {
  scope_alignment: { score: number }
  certifications_match: number
  set_aside_match: number
  past_performance_relevance: { score: number }
  competition_level: { score: number }
}): number {
  const raw =
    winFactors.scope_alignment.score * WIN_WEIGHTS.scope +
    winFactors.certifications_match * WIN_WEIGHTS.certs +
    winFactors.set_aside_match * WIN_WEIGHTS.setaside +
    winFactors.past_performance_relevance.score * WIN_WEIGHTS.perf +
    winFactors.competition_level.score * WIN_WEIGHTS.competition
  return Math.min(100, Math.max(0, Math.round(raw)))
}

// =============================================================================
// Tool schemas — defined inline (cannot import from src/ in Deno)
// =============================================================================

const extractRequirementsTool = {
  name: 'extract_requirements' as const,
  description: 'Extract all mandatory and desired requirements from a federal RFP, and identify NAICS codes',
  input_schema: {
    type: 'object' as const,
    properties: {
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            classification: { type: 'string', enum: ['mandatory', 'desired'] },
            keyword: { type: 'string', enum: ['shall', 'must', 'will', 'should', 'may'] },
            section_ref: { type: 'string' },
            page_hint: { type: 'string' },
            proposal_topic: {
              type: 'string',
              enum: ['Technical', 'Management', 'Past Performance', 'Price', 'Certifications', 'Deliverables', 'Other'],
            },
          },
          required: ['id', 'text', 'classification', 'keyword', 'section_ref', 'proposal_topic'],
          additionalProperties: false,
        },
      },
      set_asides_detected: { type: 'array', items: { type: 'string' } },
      contract_type: { type: 'string' },
      naics_codes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 5 NAICS codes ordered by relevance. First, scan the document for any explicitly stated 6-digit NAICS codes (e.g. "238210", "NAICS: 238210"). Then infer probable NAICS from the work description (e.g. electrical work → 238210, road/highway construction → 237310, building construction → 236220, plumbing/HVAC → 238220, site prep → 238910, painting → 238320). Always return at least one code. Return codes as strings without dashes or spaces.',
      },
    },
    required: ['requirements', 'set_asides_detected', 'contract_type', 'naics_codes'],
    additionalProperties: false,
  },
}

const buildComplianceMatrixTool = {
  name: 'build_compliance_matrix' as const,
  description: 'Map RFP requirements to proposal sections and build Section L/M crosswalk',
  input_schema: {
    type: 'object' as const,
    properties: {
      matrix_rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            requirement_id: { type: 'string' },
            proposal_section: {
              type: 'string',
              enum: ['Executive Summary', 'Technical Approach', 'Management Plan', 'Past Performance', 'Price Narrative', 'Cover Letter', 'Other'],
            },
            coverage_status: { type: 'string', enum: ['addressed', 'unaddressed', 'partial'] },
            rationale: { type: 'string' },
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
            section_l_ref: { type: 'string' },
            section_l_instruction: { type: 'string' },
            section_m_ref: { type: 'string' },
            section_m_criterion: { type: 'string' },
            weight: { type: 'string' },
          },
          required: ['section_l_ref', 'section_l_instruction', 'section_m_ref', 'section_m_criterion', 'weight'],
          additionalProperties: false,
        },
      },
    },
    required: ['matrix_rows', 'section_lm_crosswalk'],
    additionalProperties: false,
  },
}

const scoreWinProbabilityTool = {
  name: 'score_win_probability' as const,
  description: 'Score win probability factors for a contractor against this RFP',
  input_schema: {
    type: 'object' as const,
    properties: {
      scope_alignment: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          reasoning: { type: 'string' },
          gaps: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning'],
        additionalProperties: false,
      },
      past_performance_relevance: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          reasoning: { type: 'string' },
          matching_projects: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning'],
        additionalProperties: false,
      },
      competition_level: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          reasoning: { type: 'string' },
          indicators: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'reasoning'],
        additionalProperties: false,
      },
    },
    required: ['scope_alignment', 'past_performance_relevance', 'competition_level'],
    additionalProperties: false,
  },
}

// =============================================================================
// Main handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  try {
    // 1. Claim next pending analysis job (atomic — FOR UPDATE SKIP LOCKED)
    const { data: jobs, error: claimError } = await supabase.rpc('claim_next_job', { p_job_type: 'analysis' })

    if (claimError) {
      console.error('Failed to claim analysis job:', claimError)
      return new Response(JSON.stringify({ error: 'Failed to claim job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const job: AnalysisJob | undefined = jobs?.[0]

    if (!job) {
      return new Response(JSON.stringify({ message: 'no analysis jobs pending' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing analysis job ${job.id} for proposal ${job.proposal_id}`)

    // 2. Load data in parallel
    const [proposalResult, profileResult, projectsResult] = await Promise.all([
      supabase.from('proposals').select('rfp_text, rfp_structure, title').eq('id', job.proposal_id).single(),
      supabase.from('profiles').select('certifications, naics_codes, capability_statement, subscription_status, trial_ends_at').eq('id', job.user_id).single(),
      supabase.from('past_projects').select('*').eq('user_id', job.user_id),
    ])

    const profile = profileResult.data

    // Check subscription inline (cannot import isSubscriptionActive from src/)
    const isActive =
      profile?.subscription_status === 'active' ||
      (profile?.subscription_status === 'trialing' &&
       new Date(profile.trial_ends_at ?? 0) > new Date())

    if (!isActive) {
      await failJob(supabase, job, 'Subscription inactive — analysis skipped')
      return okResponse(corsHeaders, { skipped: true, reason: 'subscription_inactive' })
    }

    const proposal = proposalResult.data
    if (!proposal?.rfp_text) {
      await failJob(supabase, job, 'No rfp_text found for proposal — document may not be parsed yet')
      return okResponse(corsHeaders, { error: 'no rfp_text' })
    }

    const rfpText = proposal.rfp_text as string
    const contractorCerts = (profile?.certifications as string[]) ?? []

    // 3. Algorithmic detection (no LLM) — fast, no cost
    const setAsidesDetected = detectSetAsides(rfpText)
    const primarySetAside = detectPrimarySetAside(rfpText)
    const setAsideFlags = generateSetAsideFlags(rfpText, contractorCerts)
    const { hasL, hasM } = detectSectionLM(rfpText)

    const rfpStructure = proposal.rfp_structure as { sections?: Array<{ number: string; title: string }> } | null
    const sectionsContext = rfpStructure?.sections?.map(s => `${s.number}: ${s.title}`).join('\n') ?? 'No section structure available'

    // Token tracking across all 3 calls
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCachedTokens = 0

    // 4. Claude Call 1 — extract_requirements (ANALYZE-01)
    const call1Response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: `You are an expert federal government proposal analyst. Extract every requirement from this RFP.\n\nKnown sections:\n${sectionsContext}`,
          // No cache_control — this block changes per-call
        },
        {
          type: 'text',
          text: `FULL RFP TEXT:\n\n${rfpText}`,
          cache_control: { type: 'ephemeral' } as const,  // Cache the document — stable across all 3 calls
        },
      ],
      tools: [extractRequirementsTool],
      tool_choice: { type: 'tool', name: 'extract_requirements' },
      messages: [
        {
          role: 'user',
          content: [
            'Extract all mandatory and desired requirements from this RFP. For each requirement, provide the verbatim text, classify as mandatory (shall/must/will) or desired (should/may), identify the section reference and page hint, and categorize the proposal topic area.',
            '',
            'Also extract NAICS codes for the naics_codes field:',
            '1. Scan the document for any explicitly stated 6-digit NAICS code (look near "NAICS", "Product Service Code", "PSC", solicitation cover page, Section B, or SF-1449/SF-33 blocks).',
            '2. If no explicit code is found, infer up to 4 probable NAICS codes from the work description and scope of work.',
            '   Common construction NAICS mappings:',
            '   - Electrical work / wiring / power systems → 238210',
            '   - Plumbing / HVAC / mechanical → 238220',
            '   - Roofing → 238160',
            '   - Painting / wall covering → 238320',
            '   - Site prep / earthwork / demolition → 238910',
            '   - Road / highway / bridge / civil → 237310',
            '   - Utility line / pipeline → 237120',
            '   - Commercial building construction → 236220',
            '   - Residential construction → 236115',
            '   - Drywall / insulation / framing → 238110',
            '   - Concrete / masonry → 238140',
            '   - Landscaping → 561730',
            '   - Facilities maintenance / janitorial → 561720',
            '   - Architecture / engineering → 541310 / 541330',
            '3. Return up to 5 codes total, ordered by relevance (most likely first).',
            '4. Always return at least one code — use 236220 (Commercial Building Construction) as last-resort fallback if scope is truly unclear.',
          ].join('\n'),
        },
      ],
    })

    // CRITICAL: check for truncation after every Claude call
    if (call1Response.stop_reason === 'max_tokens') {
      await failJob(supabase, job, 'Requirements extraction exceeded max_tokens — RFP may be too large or complex. Retry with manual review.')
      return okResponse(corsHeaders, { error: 'max_tokens on call 1' })
    }

    const call1Content = call1Response.content.find(c => c.type === 'tool_use')
    if (!call1Content || call1Content.type !== 'tool_use') {
      await failJob(supabase, job, 'Claude did not return tool_use for requirements extraction')
      return okResponse(corsHeaders, { error: 'no tool_use in call 1' })
    }

    const extractionResult = call1Content.input as {
      requirements: Array<{
        id: string
        text: string
        classification: string
        keyword: string
        section_ref: string
        page_hint?: string
        proposal_topic: string
      }>
      set_asides_detected: string[]
      contract_type: string
      naics_codes: string[]
    }

    totalInputTokens += call1Response.usage.input_tokens
    totalOutputTokens += call1Response.usage.output_tokens
    totalCachedTokens += (call1Response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0

    console.log(`Call 1 complete: ${extractionResult.requirements.length} requirements extracted`)

    // 5. Claude Call 2 — build_compliance_matrix (ANALYZE-02 + ANALYZE-05)
    const reqSummary = extractionResult.requirements
      .map(r => `${r.id}: ${r.text.slice(0, 100)}`)
      .join('\n')

    const call2Response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      system: [
        {
          type: 'text',
          text: `You are an expert federal government proposal analyst. Map RFP requirements to proposal sections and identify Section L/M crosswalk.\n\nExtracted requirements:\n${reqSummary}\n\nHas Section L: ${hasL}\nHas Section M: ${hasM}`,
          // No cache_control — this block changes per-call
        },
        {
          type: 'text',
          text: `FULL RFP TEXT:\n\n${rfpText}`,
          cache_control: { type: 'ephemeral' } as const,  // Cache hit on calls 2+3
        },
      ],
      tools: [buildComplianceMatrixTool],
      tool_choice: { type: 'tool', name: 'build_compliance_matrix' },
      messages: [
        {
          role: 'user',
          content: `Map each extracted requirement to the appropriate proposal section (Executive Summary, Technical Approach, Management Plan, Past Performance, Price Narrative, Cover Letter, or Other). Mark coverage_status as 'unaddressed' for all (this is a new proposal with no draft yet). ${hasL || hasM ? 'Also build the Section L/M crosswalk table mapping each Section L instruction to its corresponding Section M evaluation criterion.' : 'This solicitation does not appear to use FAR Part 15 format. Return empty section_lm_crosswalk array.'}`,
        },
      ],
    })

    if (call2Response.stop_reason === 'max_tokens') {
      await failJob(supabase, job, 'Compliance matrix build exceeded max_tokens — RFP may be too complex. Retry with manual review.')
      return okResponse(corsHeaders, { error: 'max_tokens on call 2' })
    }

    const call2Content = call2Response.content.find(c => c.type === 'tool_use')
    if (!call2Content || call2Content.type !== 'tool_use') {
      await failJob(supabase, job, 'Claude did not return tool_use for compliance matrix')
      return okResponse(corsHeaders, { error: 'no tool_use in call 2' })
    }

    const complianceResult = call2Content.input as {
      matrix_rows: Array<{
        requirement_id: string
        proposal_section: string
        coverage_status: string
        rationale: string
      }>
      section_lm_crosswalk: Array<{
        section_l_ref: string
        section_l_instruction: string
        section_m_ref: string
        section_m_criterion: string
        weight: string
      }>
    }

    totalInputTokens += call2Response.usage.input_tokens
    totalOutputTokens += call2Response.usage.output_tokens
    totalCachedTokens += (call2Response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0

    console.log(`Call 2 complete: ${complianceResult.matrix_rows.length} matrix rows, ${complianceResult.section_lm_crosswalk.length} crosswalk entries`)

    // 6. Claude Call 3 — score_win_probability (ANALYZE-03 partial)
    const capabilityStatement = profile?.capability_statement ?? 'No capability statement on file.'
    const pastProjectsSummary = (projectsResult.data ?? [])
      .map((p: Record<string, unknown>) => `${p.agency ?? 'Unknown'}: ${String(p.scope_narrative ?? '').slice(0, 200)}`)
      .join('\n') || 'No past projects on file.'

    const call3Response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      system: [
        {
          type: 'text',
          text: `You are an expert federal government proposal analyst. Evaluate win probability factors.\n\nContractor capability statement:\n${capabilityStatement}\n\nContractor past projects:\n${pastProjectsSummary}\n\nContractor NAICS codes: ${(profile?.naics_codes as string[] ?? []).join(', ') || 'None listed'}`,
          // No cache_control — this block changes per-call
        },
        {
          type: 'text',
          text: `FULL RFP TEXT:\n\n${rfpText}`,
          cache_control: { type: 'ephemeral' } as const,  // Cache hit on call 3
        },
      ],
      tools: [scoreWinProbabilityTool],
      tool_choice: { type: 'tool', name: 'score_win_probability' },
      messages: [
        {
          role: 'user',
          content: 'Evaluate the following win probability factors for this contractor against this RFP: (1) scope_alignment — how well the contractor capability matches the RFP scope (0-100), (2) past_performance_relevance — how relevant the contractor past projects are to this solicitation (0-100), (3) competition_level — estimated competition level based on RFP signals (100 = low competition/good for contractor). Provide reasoning and supporting details for each factor.',
        },
      ],
    })

    if (call3Response.stop_reason === 'max_tokens') {
      await failJob(supabase, job, 'Win probability scoring exceeded max_tokens. Retry with manual review.')
      return okResponse(corsHeaders, { error: 'max_tokens on call 3' })
    }

    const call3Content = call3Response.content.find(c => c.type === 'tool_use')
    if (!call3Content || call3Content.type !== 'tool_use') {
      await failJob(supabase, job, 'Claude did not return tool_use for win probability scoring')
      return okResponse(corsHeaders, { error: 'no tool_use in call 3' })
    }

    const winProbResult = call3Content.input as {
      scope_alignment: { score: number; reasoning: string; gaps?: string[] }
      past_performance_relevance: { score: number; reasoning: string; matching_projects?: string[] }
      competition_level: { score: number; reasoning: string; indicators?: string[] }
    }

    totalInputTokens += call3Response.usage.input_tokens
    totalOutputTokens += call3Response.usage.output_tokens
    totalCachedTokens += (call3Response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0

    console.log(`Call 3 complete: scope=${winProbResult.scope_alignment.score}, perf=${winProbResult.past_performance_relevance.score}, competition=${winProbResult.competition_level.score}`)

    // 7. Compute algorithmic factors + final win score (inline — cannot import from src/)
    const certsScore = computeCertificationsScore(contractorCerts, setAsidesDetected)
    const setAsideScore = computeSetAsideScore(contractorCerts, primarySetAside)

    const winFactors = {
      scope_alignment: winProbResult.scope_alignment,
      certifications_match: certsScore,
      set_aside_match: setAsideScore,
      past_performance_relevance: winProbResult.past_performance_relevance,
      competition_level: winProbResult.competition_level,
    }

    const winScore = computeWinScore(winFactors)

    // Determine crosswalk note
    const crosswalkNote = !hasL
      ? 'This solicitation does not use UCF format. Section L/M crosswalk not applicable.'
      : null

    // Normalize and validate naics_codes from extraction (ensure 6-digit strings only)
    const rawNaicsCodes: string[] = Array.isArray(extractionResult.naics_codes)
      ? extractionResult.naics_codes
      : []
    const naicsCodes = rawNaicsCodes
      .map((c: string) => String(c).replace(/\D/g, ''))
      .filter((c: string) => /^\d{6}$/.test(c))
      .slice(0, 5)

    console.log(`NAICS codes extracted: [${naicsCodes.join(', ')}]`)

    // 8. Write rfp_analysis row (upsert — re-analysis overwrites cleanly)
    const { error: insertError } = await supabase.from('rfp_analysis').upsert({
      proposal_id: job.proposal_id,
      user_id: job.user_id,
      requirements: extractionResult.requirements,
      compliance_matrix: complianceResult.matrix_rows,
      win_score: winScore,
      win_factors: winFactors,
      set_asides_detected: setAsidesDetected,
      set_aside_flags: setAsideFlags,
      section_lm_crosswalk: complianceResult.section_lm_crosswalk,
      has_section_l: hasL,
      has_section_m: hasM,
      crosswalk_note: crosswalkNote,
      naics_codes: naicsCodes,
      analyzed_at: new Date().toISOString(),
      model_used: 'claude-sonnet-4-6',
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      tokens_cached: totalCachedTokens,
    }, { onConflict: 'proposal_id' })

    if (insertError) {
      await failJob(supabase, job, `Failed to write rfp_analysis: ${insertError.message}`)
      return okResponse(corsHeaders, { error: 'rfp_analysis insert failed' })
    }

    // 9. Update proposals.status = 'analyzed'
    await supabase
      .from('proposals')
      .update({
        status: 'analyzed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.proposal_id)

    // 10. Mark analysis job completed
    await supabase
      .from('document_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    console.log(`Analysis job ${job.id} completed. winScore=${winScore}, tokens: input=${totalInputTokens} output=${totalOutputTokens} cached=${totalCachedTokens}`)

    return okResponse(corsHeaders, {
      success: true,
      proposalId: job.proposal_id,
      winScore,
      requirements: extractionResult.requirements.length,
      matrixRows: complianceResult.matrix_rows.length,
      tokens: { input: totalInputTokens, output: totalOutputTokens, cached: totalCachedTokens },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unexpected error in analyze-proposal:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// =============================================================================
// Helper: Mark job as failed — leaves proposal at 'ready' so user can still see parsed doc
// =============================================================================
async function failJob(
  supabase: ReturnType<typeof createClient>,
  job: AnalysisJob,
  errorMessage: string
): Promise<void> {
  console.error(`Analysis job ${job.id} failed: ${errorMessage}`)

  await supabase
    .from('document_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  // Do NOT reset proposal.status — leave at 'ready' so user can view parsed document
  // Analysis failure ≠ ingestion failure
}

// =============================================================================
// Helper: Shorthand JSON response with CORS headers
// =============================================================================
function okResponse(corsHeaders: Record<string, string>, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
