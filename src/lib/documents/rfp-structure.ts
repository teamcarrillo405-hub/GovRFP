export interface RfpSection {
  number: string
  title: string
  pageRef?: number
}

export interface RfpRequirement {
  text: string
  type: 'shall' | 'must' | 'will' | 'should'
  sectionRef?: string
}

export interface RfpStructure {
  sections: RfpSection[]
  requirements: RfpRequirement[]
}

// Matches patterns like:
// "SECTION C - DESCRIPTION/SPECIFICATIONS"
// "SECTION L - Instructions to Offerors"
// "1.0 Scope of Work"
// "1.1.2 Technical Requirements"
// "C.1 General Requirements"
const SECTION_PATTERN = /^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:]\s*(.+)|(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,}))/gm

// Matches shall/must/will/should keywords
const REQUIREMENT_KEYWORDS = /\b(shall|must|will|should)\b/i

export function extractRfpStructure(text: string): RfpStructure {
  const sections: RfpSection[] = []
  const requirements: RfpRequirement[] = []

  // Extract sections
  const sectionRegex = new RegExp(SECTION_PATTERN.source, SECTION_PATTERN.flags)
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(text)) !== null) {
    const number = (match[1] ?? match[3] ?? '').trim()
    const title = (match[2] ?? match[4] ?? '').trim()
    if (number && title && title.length < 200) {
      sections.push({ number, title })
    }
  }

  // Extract requirements — split text into sentences, check each
  const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)\s*/)
  let currentSection: string | undefined

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    // Track which section we're in
    const secMatch = trimmed.match(
      /^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:])|(^\d+(?:\.\d+)*)\s/,
    )
    if (secMatch) {
      currentSection = (secMatch[1] ?? secMatch[2] ?? '').trim()
    }

    const kwMatch = trimmed.match(REQUIREMENT_KEYWORDS)
    if (kwMatch && trimmed.length > 20 && trimmed.length < 1000) {
      const keyword = kwMatch[1].toLowerCase() as RfpRequirement['type']
      requirements.push({
        text: trimmed,
        type: keyword,
        sectionRef: currentSection,
      })
    }
  }

  return { sections, requirements }
}
