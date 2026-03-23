import type { JSONContent } from '@tiptap/react'
import type { AnalysisRequirement } from '@/lib/analysis/types'
import type { SectionName, ComplianceCoverage } from './types'

/** Recursively extract all text from Tiptap JSON */
export function extractText(json: JSONContent): string {
  if (json.text) return json.text
  return (json.content ?? []).map(extractText).join(' ')
}

/** Map proposal_topic values to the section names they apply to */
const TOPIC_TO_SECTIONS: Record<string, SectionName[]> = {
  'Technical': ['Executive Summary', 'Technical Approach'],
  'Certifications': ['Executive Summary'],
  'Management': ['Management Plan'],
  'Past Performance': ['Past Performance'],
  'Price': ['Price Narrative'],
  'Deliverables': ['Technical Approach'],
  'Other': ['Executive Summary', 'Technical Approach'],
}

/** Scan section content against requirements, return coverage map */
export function scanCompliance(
  sectionJson: JSONContent,
  requirements: AnalysisRequirement[],
  sectionName: SectionName
): ComplianceCoverage {
  const sectionText = extractText(sectionJson).toLowerCase()
  const result: ComplianceCoverage = new Map()

  for (const req of requirements) {
    const applicableSections = TOPIC_TO_SECTIONS[req.proposal_topic] ?? []
    if (!applicableSections.includes(sectionName)) continue

    // Extract 4+ letter keywords from requirement text
    const keywords = req.text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []
    if (keywords.length === 0) {
      result.set(req.id, 'addressed') // no keywords to check
      continue
    }
    const matchCount = keywords.filter(kw => sectionText.includes(kw)).length
    const coverage = matchCount / keywords.length
    result.set(req.id, coverage >= 0.6 ? 'addressed' : coverage >= 0.3 ? 'partial' : 'unaddressed')
  }

  return result
}
