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
    differentiators?: string
    emr?: number | null
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
  const differentiators = profile?.differentiators ?? ''
  const emr = profile?.emr ?? null

  const COMMON_FOOTER = `\nWrite in clear, professional proposal language. Use HTML tags for structure (h2, h3, p, ul, li). Output raw HTML only — no markdown, no code fences, no backticks. Start directly with an HTML tag. Never use em dashes (— or –); use commas, colons, or rewrite the sentence instead.

CRITICAL RULE: Never fabricate or invent specific details (project names, contract numbers, dollar amounts, employee names, certifications) that were not provided above. If a data field is missing or marked "No past projects provided" / "No key personnel provided", write placeholder text in brackets like [INSERT PAST PROJECT] or [INSERT PERSONNEL NAME] rather than making up information. The client will fill in the real details.`

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
${differentiators ? `Key Differentiators: ${differentiators}` : ''}
${emr !== null ? `Safety Record (EMR): ${emr} — highlight this as a competitive strength if below 1.0` : ''}

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
${differentiators ? `Company Differentiators: ${differentiators}` : ''}
${emr !== null ? `EMR (Safety Rate): ${emr}` : ''}

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

    case 'Staffing Plan': {
      const allPersonnel = keyPersonnel
        .map(
          (p) =>
            `Name: ${p.name ?? 'TBD'}\nTitle: ${p.title ?? 'Staff'}\nExperience: ${(p.experience ?? '').slice(0, 200)}`
        )
        .join('\n\n')

      sectionText = `Draft the Staffing Plan section for a government proposal.

Company: ${companyName}

Key Personnel:
${allPersonnel || 'No key personnel provided.'}

Detail how the team will be staffed, including roles, qualifications, and availability to support the contract.`
      break
    }

    case 'Quality Control Plan': {
      sectionText = `Draft the Quality Control Plan section for a government proposal.

Company: ${companyName}
Certifications: ${certifications.length > 0 ? certifications.join(', ') : 'None'}

Describe the quality assurance and quality control processes, inspection procedures, corrective action processes, and how the company will ensure all deliverables meet contract requirements.`
      break
    }

    case 'Safety Plan': {
      sectionText = `Draft the Safety Plan section for a government proposal.

Company: ${companyName}
Certifications: ${certifications.length > 0 ? certifications.join(', ') : 'None'}

Describe the health and safety program, hazard identification and mitigation procedures, incident reporting, and the company's commitment to maintaining a safe work environment.`
      break
    }

    case 'Project Schedule': {
      sectionText = `Draft the Project Schedule section for a government proposal.

Company: ${companyName}

Describe the proposed project schedule including major milestones, phased delivery approach, and how the team will ensure on-time delivery. Reference any key deliverables and schedule constraints from the RFP.`
      break
    }

    case 'Cover Letter': {
      sectionText = `Draft a professional Cover Letter for a government proposal.

Company: ${companyName}
Certifications: ${certifications.length > 0 ? certifications.join(', ') : 'None'}
Capability Statement: ${capabilityStatement}

Write a concise cover letter introducing the company, expressing interest in the opportunity, and summarizing the key value proposition. The tone should be professional and confident.`
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
