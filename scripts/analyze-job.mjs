// Local script to run analysis on a pending analysis job
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL = 'https://qxiziskdrbhtoyorwfxy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const SET_ASIDE_PATTERNS = {
  '8(a)':    /\b8\s*\(a\)\b|\b8a\s+(?:set[-\s]aside|program|contract)\b/i,
  'HUBZone': /\bhubzone\b|\bhistorically\s+underutilized\s+business\s+zone\b/i,
  'SDVOSB':  /\bsdvosb\b|\bservice[-\s]disabled\s+veteran[-\s]owned\s+small\s+business\b/i,
  'WOSB':    /\bwosb\b|\bwomen[-\s]owned\s+small\s+business\b/i,
  'SDB':     /\bsdb\b|\bsmall\s+disadvantaged\s+business\b/i,
  'SBSA':    /\bsmall\s+business\s+set[-\s]aside\b|\btotal\s+small\s+business\b/i,
}

function detectSetAsides(text) {
  return Object.entries(SET_ASIDE_PATTERNS).filter(([,p]) => p.test(text)).map(([n]) => n)
}

async function run() {
  // Claim next pending analysis job
  const { data: jobs, error } = await supabase.rpc('claim_next_job', { p_job_type: 'analysis' })
  if (error) { console.error('Claim error:', error); process.exit(1) }
  const job = jobs?.[0]
  if (!job) { console.log('No pending analysis jobs.'); process.exit(0) }

  console.log(`Analyzing proposal ${job.proposal_id}...`)

  // Load proposal rfp_text
  const { data: proposal } = await supabase.from('proposals').select('rfp_text').eq('id', job.proposal_id).single()
  if (!proposal?.rfp_text) { console.error('No rfp_text found'); process.exit(1) }

  const rfpText = proposal.rfp_text

  // Load contractor profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', job.user_id).single()
  const certifications = profile?.certifications ?? []

  console.log('Running Claude analysis (3 calls)...')

  // Call 1: Extract requirements
  const req1 = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text', text: 'You are a government contract analyst. Extract requirements from RFPs.' },
      { type: 'text', text: `RFP TEXT:\n${rfpText}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: 'Extract all requirements from the RFP text provided.' }],
    tools: [{
      name: 'extract_requirements',
      description: 'Extract all requirements from the RFP',
      input_schema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                category: { type: 'string', enum: ['technical', 'management', 'past_performance', 'price', 'administrative'] },
                priority: { type: 'string', enum: ['mandatory', 'desired'] },
                section_ref: { type: 'string' }
              },
              required: ['id', 'text', 'category', 'priority']
            }
          }
        },
        required: ['requirements']
      }
    }],
    tool_choice: { type: 'tool', name: 'extract_requirements' }
  })

  const reqResult = req1.content.find(b => b.type === 'tool_use')
  const requirements = reqResult?.input?.requirements ?? []
  console.log(`Extracted ${requirements.length} requirements`)

  // Call 2: Build compliance matrix
  const req2 = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text', text: 'You are a government contract analyst. Build compliance matrices.' },
      { type: 'text', text: `RFP TEXT:\n${rfpText}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: 'Build the compliance matrix for this RFP.' }],
    tools: [{
      name: 'build_compliance_matrix',
      description: 'Build a compliance matrix mapping requirements to proposal sections',
      input_schema: {
        type: 'object',
        properties: {
          matrix: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                requirement_id: { type: 'string' },
                proposal_section: { type: 'string' },
                coverage_status: { type: 'string', enum: ['covered', 'partial', 'not_covered'] },
                notes: { type: 'string' }
              },
              required: ['requirement_id', 'proposal_section', 'coverage_status']
            }
          }
        },
        required: ['matrix']
      }
    }],
    tool_choice: { type: 'tool', name: 'build_compliance_matrix' }
  })

  const matrixResult = req2.content.find(b => b.type === 'tool_use')
  const complianceMatrix = matrixResult?.input?.matrix ?? []
  console.log(`Built compliance matrix with ${complianceMatrix.length} entries`)

  // Call 3: Win score
  const req3 = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      { type: 'text', text: 'You are a government contract analyst. Score win probability.' },
      { type: 'text', text: `RFP TEXT:\n${rfpText}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: 'Score the win probability for this RFP.' }],
    tools: [{
      name: 'score_win_probability',
      description: 'Score the win probability for this RFP',
      input_schema: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100 win probability score' },
          scope_alignment: { type: 'number', description: '0-100' },
          competition_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          reasoning: { type: 'string' }
        },
        required: ['score', 'reasoning']
      }
    }],
    tool_choice: { type: 'tool', name: 'score_win_probability' }
  })

  const winResult = req3.content.find(b => b.type === 'tool_use')
  const winFactors = winResult?.input ?? {}
  const winScore = Math.round(winFactors.score ?? 50)
  console.log(`Win score: ${winScore}`)

  // Detect set-asides
  const setAsidesDetected = detectSetAsides(rfpText)
  const setAsideFlags = setAsidesDetected.map(program => ({
    program,
    detected_in_rfp: true,
    contractor_eligible: certifications.map(c => c.toLowerCase()).includes(program.toLowerCase()),
    is_match: certifications.map(c => c.toLowerCase()).includes(program.toLowerCase()),
  }))

  // Save to rfp_analysis
  const { error: insertError } = await supabase.from('rfp_analysis').upsert({
    proposal_id: job.proposal_id,
    user_id: job.user_id,
    requirements,
    compliance_matrix: complianceMatrix,
    win_score: winScore,
    win_factors: winFactors,
    set_asides_detected: setAsidesDetected,
    set_aside_flags: setAsideFlags,
    section_lm_crosswalk: [],
    analyzed_at: new Date().toISOString(),
    model_used: 'claude-sonnet-4-6',
  }, { onConflict: 'proposal_id' })

  if (insertError) { console.error('Insert error:', insertError); process.exit(1) }

  // Update proposal status to analyzed
  await supabase.from('proposals').update({ status: 'analyzed', updated_at: new Date().toISOString() }).eq('id', job.proposal_id)

  // Mark job complete
  await supabase.from('document_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id)

  console.log('Analysis complete! Proposal status set to analyzed.')
}

run().catch(console.error)
