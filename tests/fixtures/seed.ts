import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

export const ADMIN_USER_ID = '6e71ebba-0cdb-4f48-8908-3251f101c2eb'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

function testTitle(label?: string) {
  return `E2E Test — ${label ?? Date.now()}`
}

const SAMPLE_RFP_TEXT = `Request for Proposal – Construction Management Services
This is a small business set-aside contract.
1 Project Information
The contractor shall provide construction management services.
The contractor must submit qualifications within 30 days.
2 Scope of Services
The contractor will coordinate with all subcontractors.
The contractor shall maintain a project schedule.
3 Submission Requirements
Offerors must include past performance references.`

const SAMPLE_RFP_STRUCTURE = {
  sections: [
    { number: '1', title: 'Project Information' },
    { number: '2', title: 'Scope of Services' },
    { number: '3', title: 'Submission Requirements' },
  ],
  requirements: [
    { text: 'The contractor shall provide construction management services.', type: 'shall', sectionRef: '1' },
    { text: 'The contractor must submit qualifications within 30 days.', type: 'must', sectionRef: '1' },
    { text: 'The contractor will coordinate with all subcontractors.', type: 'will', sectionRef: '2' },
  ],
}

const SAMPLE_REQUIREMENTS = Array.from({ length: 10 }, (_, i) => ({
  id: `REQ-${String(i + 1).padStart(3, '0')}`,
  text: `The contractor shall fulfill requirement ${i + 1} as specified.`,
  classification: i % 2 === 0 ? 'mandatory' : 'desired',
  keyword: i % 2 === 0 ? 'shall' : 'should',
  section_ref: String((i % 3) + 1),
  proposal_topic: 'Technical',
}))

const SAMPLE_MATRIX = Array.from({ length: 10 }, (_, i) => ({
  requirement_id: `REQ-${String(i + 1).padStart(3, '0')}`,
  proposal_section: 'Technical Approach',
  coverage_status: i < 7 ? 'addressed' : 'partial',
  rationale: 'Addressed in technical approach section.',
}))

const SAMPLE_WIN_FACTORS = {
  scope_alignment: { score: 72, reasoning: 'Good scope alignment with contractor capabilities.' },
  certifications_match: 75,
  set_aside_match: 100,
  past_performance_relevance: { score: 65, reasoning: 'Relevant past performance in construction.' },
  competition_level: { score: 60, reasoning: 'Moderate competition expected.' },
}

export class SeedClient {
  private supabase = makeClient()

  async seedAnalyzedProposal(label?: string): Promise<{ proposalId: string }> {
    const { data: proposal, error } = await this.supabase
      .from('proposals')
      .insert({
        user_id: ADMIN_USER_ID,
        title: testTitle(label),
        status: 'analyzed',
        file_name: 'rfp-sample.pdf',
        file_type: 'pdf',
        rfp_text: SAMPLE_RFP_TEXT,
        rfp_structure: SAMPLE_RFP_STRUCTURE,
        page_count: 2,
        is_scanned: false,
        ocr_used: false,
      })
      .select('id')
      .single()

    if (error || !proposal) throw new Error(`seedAnalyzedProposal failed: ${error?.message}`)

    const { error: analysisError } = await this.supabase
      .from('rfp_analysis')
      .insert({
        proposal_id: proposal.id,
        user_id: ADMIN_USER_ID,
        requirements: SAMPLE_REQUIREMENTS,
        compliance_matrix: SAMPLE_MATRIX,
        win_score: 72,
        win_factors: SAMPLE_WIN_FACTORS,
        set_asides_detected: ['SBSA'],
        set_aside_flags: [{ program: 'SBSA', detected_in_rfp: true, contractor_eligible: true, is_match: true }],
        section_lm_crosswalk: [],
        has_section_l: false,
        has_section_m: false,
        analyzed_at: new Date().toISOString(),
        model_used: 'claude-sonnet-4-6',
      })

    if (analysisError) throw new Error(`seedAnalyzedProposal rfp_analysis failed: ${analysisError.message}`)

    return { proposalId: proposal.id }
  }

  async seedReadyProposal(label?: string): Promise<{ proposalId: string }> {
    const { data: proposal, error } = await this.supabase
      .from('proposals')
      .insert({
        user_id: ADMIN_USER_ID,
        title: testTitle(label),
        status: 'ready',
        file_name: 'rfp-sample.pdf',
        file_type: 'pdf',
        rfp_text: SAMPLE_RFP_TEXT,
        rfp_structure: SAMPLE_RFP_STRUCTURE,
        page_count: 2,
        is_scanned: false,
        ocr_used: false,
      })
      .select('id')
      .single()

    if (error || !proposal) throw new Error(`seedReadyProposal failed: ${error?.message}`)
    return { proposalId: proposal.id }
  }

  async seedSectionDraft(proposalId: string, sectionName: string, text: string): Promise<void> {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    }
    const { error } = await this.supabase
      .from('proposal_sections')
      .upsert({
        proposal_id: proposalId,
        user_id: ADMIN_USER_ID,
        section_name: sectionName,
        content,
        draft_status: 'draft',
        last_saved_at: new Date().toISOString(),
      }, { onConflict: 'proposal_id,section_name' })

    if (error) throw new Error(`seedSectionDraft failed: ${error.message}`)
  }

  async deleteProposal(proposalId: string): Promise<void> {
    await this.supabase.from('proposals').delete().eq('id', proposalId)
  }

  async updateProfileSubscription(status: string): Promise<void> {
    await this.supabase
      .from('profiles')
      .update({ subscription_status: status })
      .eq('id', ADMIN_USER_ID)
  }
}
