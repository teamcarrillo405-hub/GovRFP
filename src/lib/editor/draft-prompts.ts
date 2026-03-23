import type Anthropic from '@anthropic-ai/sdk'
import type { SectionName } from '@/lib/editor/types'
import type { AnalysisRequirement } from '@/lib/analysis/types'

type SystemBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: 'ephemeral' }
}

/**
 * Build the system prompt array for a given proposal section.
 *
 * Returns an array of two system blocks:
 *   [0] Section-specific instructions with injected profile data
 *   [1] Full RFP text with cache_control: { type: 'ephemeral' } for prompt caching
 */
export function buildSectionPrompt(
  section: SectionName,
  profile: {
    company_name?: string
    certifications?: string[]
    naics_codes?: string[]
    capability_statement?: string
  } | null,
  pastProjects: Array<{
    agency?: string
    scope_narrative?: string
    contract_value?: number
    outcome?: string
    period_start?: string
    period_end?: string
  }>,
  keyPersonnel: Array<{
    name?: string
    title?: string
    experience?: string
  }>,
  rfpText: string,
  requirements: AnalysisRequirement[],
  instruction?: string
): SystemBlock[] {
  const companyName = profile?.company_name ?? 'the contractor'
  const certifications = profile?.certifications ?? []
  const capabilityStatement = profile?.capability_statement ?? ''

  const COMMON_FOOTER = `\nWrite in clear, professional proposal language. Use headings (## format) and bullet points where appropriate. Output HTML suitable for a rich text editor.`

  let sectionText: string

  switch (section) {
    case 'Executive Summary': {
      const personnelSummary = keyPersonnel
        .slice(0, 5)
        .map((p) => `${p.name ?? 'TBD'} (${p.title ?? 'Staff'})`)
        .join(', ')

      const projectSummary = pastProjects
        .slice(0, 5)
        .map((p) => `${p.agency ?? 'Agency'}: ${(p.scope_narrative ?? '').slice(0, 200)}`)
        .join('\n')

      const relevantReqs = requirements
        .filter((r) => ['Technical', 'Management'].includes(r.proposal_topic))
        .slice(0, 5)
        .map((r) => `- ${r.text}`)
        .join('\n')

      sectionText = `Draft a compelling Executive Summary for a government proposal.

Company: ${companyName}
Certifications: ${certifications.length > 0 ? certifications.join(', ') : 'None'}
Capability Statement: ${capabilityStatement}

Key Personnel: ${personnelSummary}

Relevant Past Projects:
${projectSummary}

Key Requirements to Address:
${relevantReqs || 'See RFP text below.'}`
      break
    }

    case 'Technical Approach': {
      const technicalReqs = requirements
        .filter((r) => r.proposal_topic === 'Technical')
        .map((r) => `- [${r.id}] ${r.text}`)
        .join('\n')

      const relevantProjects = pastProjects
        .slice(0, 3)
        .map((p) => `${p.agency ?? 'Agency'}: ${(p.scope_narrative ?? '').slice(0, 200)}`)
        .join('\n')

      const technicalPersonnel = keyPersonnel
        .slice(0, 5)
        .map((p) => `${p.name ?? 'TBD'} (${p.title ?? 'Staff'}): ${(p.experience ?? '').slice(0, 200)}`)
        .join('\n')

      sectionText = `Draft the Technical Approach section for a government proposal.

Company: ${companyName}

Technical Requirements to Address:
${technicalReqs || 'See RFP text below.'}

Relevant Past Project Experience:
${relevantProjects || 'No past projects provided.'}

Key Technical Personnel:
${technicalPersonnel || 'No key personnel provided.'}`
      break
    }

    case 'Management Plan': {
      const allPersonnel = keyPersonnel
        .map(
          (p) =>
            `Name: ${p.name ?? 'TBD'}\nTitle: ${p.title ?? 'Staff'}\nExperience: ${(p.experience ?? '').slice(0, 200)}`
        )
        .join('\n\n')

      sectionText = `Draft the Management Plan section for a government proposal.

Company: ${companyName}

Key Personnel:
${allPersonnel || 'No key personnel provided.'}

Describe the organizational structure, lines of authority, and management approach for successful project delivery.`
      break
    }

    case 'Past Performance': {
      const projectDetails = pastProjects
        .slice(0, 5)
        .map(
          (p) =>
            `Agency: ${p.agency ?? 'N/A'}\nScope: ${(p.scope_narrative ?? '').slice(0, 300)}\nContract Value: ${p.contract_value != null ? `$${(p.contract_value / 100).toLocaleString()}` : 'N/A'}\nPeriod: ${p.period_start ?? 'N/A'} to ${p.period_end ?? 'N/A'}\nOutcome: ${p.outcome ?? 'N/A'}`
        )
        .join('\n\n---\n\n')

      sectionText = `Draft the Past Performance section for a government proposal.

Company: ${companyName}

Relevant Past Projects (limit 5):
${projectDetails || 'No past projects provided.'}

Match these past projects to the RFP scope below to demonstrate relevance and experience.`
      break
    }

    case 'Price Narrative': {
      sectionText = `Draft the Price Narrative section for a government proposal.

Company: ${companyName}
Certifications: ${certifications.length > 0 ? certifications.join(', ') : 'None'}

Discuss the approach to pricing, value proposition, and cost consciousness. Explain the basis for cost estimates, the team's ability to deliver on time and within budget, and the value delivered relative to cost.

IMPORTANT: Do NOT include any specific dollar amounts, prices, or cost figures in this narrative. The actual pricing will be submitted in a separate price volume. Focus on pricing methodology, cost control approach, and value.`
      break
    }

    default: {
      sectionText = `Draft the ${section} section for a government proposal.`
    }
  }

  // Append optional instruction
  if (instruction && instruction.trim().length > 0) {
    sectionText += `\nSpecial instruction: ${instruction}`
  }

  sectionText += COMMON_FOOTER

  const rfpBlock: SystemBlock = {
    type: 'text',
    text: `RFP Text:\n\n${rfpText}`,
    cache_control: { type: 'ephemeral' },
  }

  return [
    { type: 'text', text: sectionText },
    rfpBlock,
  ]
}
