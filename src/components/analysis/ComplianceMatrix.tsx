import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'

interface Props {
  requirements: AnalysisRequirement[]
  complianceMatrix: ComplianceMatrixRow[]
}

export default function ComplianceMatrix({ requirements, complianceMatrix }: Props) {
  if (complianceMatrix.length === 0) {
    return <p className="text-sm text-gray-500">No compliance matrix data available.</p>
  }

  const reqMap = new Map(requirements.map((r) => [r.id, r]))

  const mandatoryCount = requirements.filter((r) => r.classification === 'mandatory').length
  const desiredCount = requirements.filter((r) => r.classification === 'desired').length
  const addressedCount = complianceMatrix.filter((r) => r.coverage_status === 'addressed').length
  const unaddressedCount = complianceMatrix.filter((r) => r.coverage_status === 'unaddressed').length

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {mandatoryCount} mandatory, {desiredCount} desired requirements &mdash;{' '}
        {addressedCount} addressed, {unaddressedCount} unaddressed
      </p>

      <table className="w-full border border-gray-200 text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Req ID
            </th>
            <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Requirement
            </th>
            <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Classification
            </th>
            <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Section
            </th>
            <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Coverage
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {complianceMatrix.map((row) => {
            const req = reqMap.get(row.requirement_id)
            const text = req?.text ?? row.requirement_id
            const classification = req?.classification ?? 'mandatory'

            return (
              <tr key={row.requirement_id} className="text-gray-700">
                <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">
                  {row.requirement_id}
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <span>
                    {text.length > 200 ? text.slice(0, 200) + '...' : text}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {classification === 'mandatory' ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Mandatory
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Desired
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {row.proposal_section}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.coverage_status === 'addressed' && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Addressed
                    </span>
                  )}
                  {row.coverage_status === 'unaddressed' && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Unaddressed
                    </span>
                  )}
                  {row.coverage_status === 'partial' && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Partial
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
