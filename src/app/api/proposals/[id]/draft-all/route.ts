import { createClient } from '@/lib/supabase/server'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Map each section to the requirement topics most relevant to it */
const SECTION_TOPIC_MAP: Record<SectionName, string[]> = {
  'Cover Letter':           ['Technical', 'Management', 'Other'],
  'Executive Summary':      ['Technical', 'Management', 'Past Performance'],
  'Technical Approach':     ['Technical', 'Deliverables'],
  'Management Plan':        ['Management'],
  'Staffing Plan':          ['Management'],
  'Quality Control Plan':   ['Technical', 'Deliverables', 'Other'],
  'Safety Plan':            ['Technical', 'Other'],
  'Project Schedule':       ['Technical', 'Deliverables', 'Management'],
}

/** Build a concise inline system prompt for each section */
function buildInlinePrompt(section: SectionName, requirementsText: string): string {
  const FOOTER = `\n\nWrite in professional proposal language. Use HTML tags for structure (h2, h3, p, ul, li). Output raw HTML only — no markdown, no code fences. Never use em dashes (— or –). Do not fabricate specific names, numbers, or certifications not mentioned above; use brackets like [INSERT DETAIL] as placeholders.`

  switch (section) {
    case 'Cover Letter':
      return `You are drafting a government proposal Cover Letter. Write a concise, professional 2-3 paragraph letter introducing the company, expressing interest in the opportunity, and summarizing the key value proposition.\n\nRelevant RFP Requirements:\n${requirementsText}${FOOTER}`
    case 'Executive Summary':
      return `You are drafting a government proposal Executive Summary. Provide a compelling overview of the company's qualifications, approach, and reasons why they are the best choice for this contract. Address the most critical technical and management requirements.\n\nRelevant RFP Requirements:\n${requirementsText}${FOOTER}`
    case 'Technical Approach':
      return `You are drafting a government proposal Technical Approach section. Detail the methodology, processes, and technical solutions the company will employ to meet all technical requirements and deliverables.\n\nTechnical Requirements to Address:\n${requirementsText}${FOOTER}`
    case 'Management Plan':
      return `You are drafting a government proposal Management Plan section. Describe the organizational structure, lines of authority, communication protocols, and overall management approach for successful contract execution.\n\nManagement Requirements:\n${requirementsText}${FOOTER}`
    case 'Staffing Plan':
      return `You are drafting a government proposal Staffing Plan section. Detail the team composition, key roles and qualifications, staffing levels, and personnel availability to support the full contract period of performance.\n\nStaffing Requirements:\n${requirementsText}${FOOTER}`
    case 'Quality Control Plan':
      return `You are drafting a government proposal Quality Control Plan section. Describe the QA/QC processes, inspection procedures, corrective action processes, documentation practices, and how all deliverables will meet contract requirements.\n\nQuality Requirements:\n${requirementsText}${FOOTER}`
    case 'Safety Plan':
      return `You are drafting a government proposal Safety Plan section. Describe the health and safety program, hazard identification and mitigation, incident reporting procedures, training requirements, and commitment to a safe work environment.\n\nSafety and Compliance Requirements:\n${requirementsText}${FOOTER}`
    case 'Project Schedule':
      return `You are drafting a government proposal Project Schedule section. Present the proposed schedule including major milestones, phased approach, critical path considerations, and how the team will ensure on-time delivery of all deliverables.\n\nSchedule and Deliverable Requirements:\n${requirementsText}${FOOTER}`
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Verify user owns this proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, rfp_text')
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single()

  if (!proposal) return new Response('Not found', { status: 404 })

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'

  // Load analysis requirements and existing sections in parallel
  const [analysisRes, sectionsRes] = await Promise.all([
    supabase
      .from('rfp_analysis')
      .select('requirements, win_factors')
      .eq('proposal_id', proposalId)
      .single(),
    supabase
      .from('proposal_sections')
      .select('section_name, content')
      .eq('proposal_id', proposalId),
  ])

  const requirements = analysisRes.data?.requirements ?? []
  const rfpText = proposal.rfp_text ?? ''

  // Build a set of sections that already have content
  const existingContent = new Set<string>()
  for (const sec of (sectionsRes.data ?? [])) {
    const content = sec.content
    if (content && typeof content === 'object') {
      // TipTap JSONContent — check if there is any non-empty text
      const hasText = JSON.stringify(content).length > 50
      if (hasText) existingContent.add(sec.section_name)
    } else if (typeof content === 'string' && content.trim().length > 0) {
      existingContent.add(sec.section_name)
    }
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      const total = SECTION_NAMES.length
      let sectionsGenerated = 0
      let sectionsSkipped = 0

      try {
        for (let index = 0; index < SECTION_NAMES.length; index++) {
          const section = SECTION_NAMES[index]

          // Skip if already has content and force is not set
          if (!force && existingContent.has(section)) {
            emit('section_skip', {
              section,
              index,
              total,
              reason: 'already has content',
            })
            sectionsSkipped++
            continue
          }

          emit('section_start', { section, index, total })

          // Filter requirements relevant to this section
          const topicFilter = SECTION_TOPIC_MAP[section]
          const relevantReqs = requirements
            .filter((r: { proposal_topic: string }) => topicFilter.includes(r.proposal_topic))
            .slice(0, 10)
            .map((r: { id: string; text: string }) => `[${r.id}] ${r.text}`)
            .join('\n')

          const requirementsText = relevantReqs ||
            (rfpText ? rfpText.slice(0, 2000) : 'No specific requirements extracted. Draft a standard section.')

          const systemPrompt = buildInlinePrompt(section, requirementsText)

          // Call Claude
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Draft the ${section} section for this government proposal.`,
              },
            ],
          })

          const htmlContent =
            message.content[0].type === 'text' ? message.content[0].text : ''

          const wordCount = htmlContent
            .replace(/<[^>]+>/g, ' ')
            .split(/\s+/)
            .filter(Boolean).length

          // Save to proposal_sections (upsert on proposal_id + section_name)
          await supabase.from('proposal_sections').upsert(
            {
              proposal_id: proposalId,
              user_id: user.id,
              section_name: section,
              content: htmlContent,
              draft_status: 'draft',
              last_saved_at: new Date().toISOString(),
            },
            { onConflict: 'proposal_id,section_name' }
          )

          sectionsGenerated++
          emit('section_complete', { section, index, total, wordCount })
        }

        emit('done', { sectionsGenerated, sectionsSkipped })
      } catch (err) {
        emit('error', {
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
