import type { SectionLMEntry } from '@/lib/analysis/types'

interface Props {
  crosswalk: SectionLMEntry[]
  hasSectionL: boolean
  hasSectionM: boolean
}

export default function SectionLMCrosswalk({ crosswalk, hasSectionL, hasSectionM }: Props) {
  if (!hasSectionL && !hasSectionM) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">
        This solicitation does not appear to use the Uniform Contract Format (FAR 15.204-1).
        Section L/M crosswalk is not applicable. Requirements were extracted directly from the
        Statement of Work and attachments.
      </div>
    )
  }

  if (crosswalk.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Section L/M headers were detected but no crosswalk entries could be mapped. The evaluation
        criteria may not follow a standard L-to-M mapping.
      </p>
    )
  }

  return (
    <table className="w-full border border-gray-200 text-sm">
      <thead>
        <tr className="bg-gray-50">
          <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-1/2">
            Section L &mdash; Instructions
          </th>
          <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-1/2">
            Section M &mdash; Evaluation Criteria
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {crosswalk.map((entry, i) => (
          <tr key={i} className="text-gray-700">
            <td className="px-3 py-3 align-top">
              <span className="font-mono text-xs text-gray-500 block mb-1">
                {entry.section_l_ref}
              </span>
              <span>{entry.section_l_instruction}</span>
            </td>
            <td className="px-3 py-3 align-top">
              <span className="font-mono text-xs text-gray-500 block mb-1">
                {entry.section_m_ref}
              </span>
              <div className="flex items-start justify-between gap-2">
                <span>{entry.section_m_criterion}</span>
                {entry.weight && (
                  <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {entry.weight}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
