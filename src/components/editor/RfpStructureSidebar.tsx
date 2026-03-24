'use client'

import { useState, useRef, useEffect } from 'react'
import type { RfpSection, RfpRequirement, RfpStructure } from '@/lib/documents/rfp-structure'

interface RfpStructureSidebarProps {
  rfpStructure: RfpStructure | null
  activeRfpSection?: string | null
  onSectionClick?: (sectionTitle: string) => void
}

function getRequirementsForSection(
  section: RfpSection,
  requirements: RfpRequirement[]
): RfpRequirement[] {
  return requirements.filter((r) => r.sectionRef === section.number)
}

export default function RfpStructureSidebar({
  rfpStructure,
  activeRfpSection = null,
  onSectionClick,
}: RfpStructureSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeRfpSection || !listRef.current) return
    const activeEl = listRef.current.querySelector(`[data-section="${activeRfpSection}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeRfpSection])

  const toggleSection = (sectionNumber: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionNumber)) {
        next.delete(sectionNumber)
      } else {
        next.add(sectionNumber)
      }
      return next
    })
  }

  // Collapsed strip
  if (!isExpanded) {
    return (
      <div
        className="w-10 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200 ease-in-out"
        role="complementary"
        aria-label="RFP structure panel"
      >
        <div className="px-1 py-3 flex items-center justify-center">
          <button
            onClick={() => setIsExpanded(true)}
            aria-label="Expand RFP sidebar"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  const hasStructure = rfpStructure && rfpStructure.sections.length > 0

  return (
    <div
      className={[
        isExpanded ? 'w-64' : 'w-10',
        'shrink-0 flex flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200 ease-in-out overflow-hidden',
      ].join(' ')}
      role="complementary"
      aria-label="RFP structure panel"
    >
      {/* Header row */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">RFP Structure</span>
        <button
          onClick={() => setIsExpanded(false)}
          aria-label="Collapse RFP sidebar"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </button>
      </div>

      {/* Section list or empty state */}
      {!hasStructure ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs font-semibold text-gray-500">No structure found</p>
          <p className="text-xs text-gray-400 mt-1">
            This RFP was not parsed into sections. Review the Analysis tab to check the document parse result.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" role="list" ref={listRef}>
          {rfpStructure.sections.map((section) => {
            const sectionRequirements = getRequirementsForSection(section, rfpStructure.requirements)
            const count = sectionRequirements.length
            const isActive = activeRfpSection === section.number
            const isSectionExpanded = expandedSections.has(section.number)

            return (
              <div key={section.number} role="listitem" data-section={section.number}>
                {/* Section row button */}
                <button
                  className={[
                    'w-full flex items-center gap-2 py-2 text-left transition-colors',
                    isActive
                      ? 'border-l-2 border-blue-700 bg-white pl-[14px] pr-4'
                      : 'border-l-2 border-transparent px-4',
                    'hover:bg-gray-100',
                  ].join(' ')}
                  aria-expanded={isSectionExpanded}
                  onClick={() => {
                    onSectionClick?.(section.title)
                    toggleSection(section.number)
                  }}
                >
                  {/* Chevron */}
                  <span className="text-gray-400 shrink-0">
                    {isSectionExpanded ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    )}
                  </span>

                  {/* Section title */}
                  <span
                    className={[
                      'text-sm flex-1 truncate',
                      isActive ? 'text-blue-700 font-semibold' : 'font-semibold text-gray-700',
                    ].join(' ')}
                  >
                    {section.title}
                  </span>

                  {/* Requirement count badge */}
                  <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                </button>

                {/* Expanded requirements list */}
                {isSectionExpanded && (
                  <div className="pl-8 pr-4">
                    {sectionRequirements.length === 0 ? (
                      <div className="py-1.5">
                        <span className="text-xs text-gray-400">No requirements</span>
                      </div>
                    ) : (
                      sectionRequirements.map((req, i) => (
                        <div key={i} className="py-1.5 flex items-start gap-1.5">
                          <span className="text-gray-300 mt-0.5 text-xs shrink-0">&#183;</span>
                          <span className="text-xs text-gray-700 leading-relaxed">
                            {req.text.length > 100 ? req.text.slice(0, 100) + '...' : req.text}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
