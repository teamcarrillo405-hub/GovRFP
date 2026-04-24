'use client'

import type { AnalysisRequirement } from '@/lib/analysis/types'
import type { SectionName, ComplianceCoverage } from '@/lib/editor/types'

// Mirror the TOPIC_TO_SECTIONS mapping from compliance-scanner.ts
const TOPIC_TO_SECTIONS: Record<string, SectionName[]> = {
  'Technical': ['Executive Summary', 'Technical Approach'],
  'Certifications': ['Executive Summary'],
  'Management': ['Management Plan'],
  'Past Performance': ['Past Performance'],
  'Price': ['Price Narrative'],
  'Deliverables': ['Technical Approach'],
  'Other': ['Executive Summary', 'Technical Approach'],
}

interface Props {
  requirements: AnalysisRequirement[]
  coverage: ComplianceCoverage
  sectionName: SectionName
}

export default function CompliancePanel({ requirements, coverage, sectionName }: Props) {
  // Filter requirements that apply to the current section
  const sectionRequirements = requirements.filter((req) => {
    const applicableSections = TOPIC_TO_SECTIONS[req.proposal_topic] ?? []
    return applicableSections.includes(sectionName)
  })

  const addressedCount = sectionRequirements.filter(
    (req) => coverage.get(req.id) === 'addressed'
  ).length
  const unaddressedCount = sectionRequirements.filter(
    (req) => coverage.get(req.id) === 'unaddressed'
  ).length

  return (
    <div className="w-80 shrink-0 flex flex-col border-l border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">Compliance</span>
      </div>

      {/* Coverage summary */}
      <div className="px-4 py-2 text-xs text-gray-500">
        {addressedCount} addressed, {unaddressedCount} unaddressed
      </div>

      {/* Requirements list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
        {sectionRequirements.length === 0 && (
          <div className="px-4 py-6 text-xs text-gray-500 text-center">
            No requirements mapped to this section.
          </div>
        )}

        {sectionRequirements.map((req) => {
          const status = coverage.get(req.id)
          const truncatedText = req.text.length > 120 ? req.text.slice(0, 120) + '...' : req.text

          return (
            <div key={req.id} className="px-4 py-3">
              <p className="text-xs text-gray-700 leading-relaxed mb-1">{truncatedText}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Classification badge */}
                {req.classification === 'mandatory' ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Mandatory
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Desired
                  </span>
                )}

                {/* Coverage badge */}
                {status === 'addressed' && (
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                    Addressed
                  </span>
                )}
                {status === 'partial' && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Partial
                  </span>
                )}
                {status === 'unaddressed' && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Unaddressed
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
