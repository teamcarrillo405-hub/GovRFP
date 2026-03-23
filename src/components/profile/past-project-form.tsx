'use client'

import { useRef, useState, useTransition } from 'react'
import { createPastProject, updatePastProject } from '@/app/(dashboard)/profile/past-projects/actions'

interface PastProject {
  id: string
  contract_number: string | null
  agency: string | null
  contract_value: number | null // cents
  period_start: string | null
  period_end: string | null
  scope_narrative: string | null
  naics_code: string | null
  outcome: string | null
}

interface PastProjectFormProps {
  project?: PastProject
  onComplete: () => void
}

function centsToDisplay(cents: number | null): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

export function PastProjectForm({ project, onComplete }: PastProjectFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = project
        ? await updatePastProject(project.id, formData)
        : await createPastProject(formData)
      if (result.error) {
        setError(result.error)
      } else {
        onComplete()
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Contract Number */}
        <div>
          <label htmlFor="contract_number" className="block text-sm font-medium text-gray-700 mb-1">
            Contract Number
          </label>
          <input
            id="contract_number"
            name="contract_number"
            type="text"
            defaultValue={project?.contract_number ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. GS-06F-0001Z"
          />
        </div>

        {/* Agency */}
        <div>
          <label htmlFor="agency" className="block text-sm font-medium text-gray-700 mb-1">
            Agency
          </label>
          <input
            id="agency"
            name="agency"
            type="text"
            defaultValue={project?.agency ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Department of Defense"
          />
        </div>

        {/* Contract Value */}
        <div>
          <label htmlFor="contract_value" className="block text-sm font-medium text-gray-700 mb-1">
            Contract Value ($)
          </label>
          <input
            id="contract_value"
            name="contract_value"
            type="number"
            min="0"
            step="0.01"
            defaultValue={centsToDisplay(project?.contract_value ?? null)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="150000.00"
          />
        </div>

        {/* NAICS Code */}
        <div>
          <label htmlFor="naics_code" className="block text-sm font-medium text-gray-700 mb-1">
            NAICS Code
          </label>
          <input
            id="naics_code"
            name="naics_code"
            type="text"
            defaultValue={project?.naics_code ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="236220"
          />
        </div>

        {/* Period Start */}
        <div>
          <label htmlFor="period_start" className="block text-sm font-medium text-gray-700 mb-1">
            Period Start
          </label>
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={project?.period_start ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Period End */}
        <div>
          <label htmlFor="period_end" className="block text-sm font-medium text-gray-700 mb-1">
            Period End
          </label>
          <input
            id="period_end"
            name="period_end"
            type="date"
            defaultValue={project?.period_end ?? ''}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Scope Narrative */}
      <div>
        <label htmlFor="scope_narrative" className="block text-sm font-medium text-gray-700 mb-1">
          Scope Narrative
        </label>
        <textarea
          id="scope_narrative"
          name="scope_narrative"
          rows={4}
          defaultValue={project?.scope_narrative ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="Describe the work performed, scope, and deliverables..."
        />
      </div>

      {/* Outcome */}
      <div>
        <label htmlFor="outcome" className="block text-sm font-medium text-gray-700 mb-1">
          Outcome
        </label>
        <textarea
          id="outcome"
          name="outcome"
          rows={3}
          defaultValue={project?.outcome ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="Results, performance ratings, customer satisfaction, contract renewals..."
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onComplete}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : project ? 'Update Project' : 'Add Project'}
        </button>
      </div>
    </form>
  )
}
