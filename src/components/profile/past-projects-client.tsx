'use client'

import { useState, useTransition } from 'react'
import { PastProjectForm } from './past-project-form'

interface PastProject {
  id: string
  contract_number: string | null
  agency: string | null
  contract_value: number | null
  period_start: string | null
  period_end: string | null
  scope_narrative: string | null
  naics_code: string | null
  outcome: string | null
}

interface PastProjectsClientProps {
  projects: PastProject[]
  deletePastProject: (id: string) => Promise<{ success?: boolean; error?: string }>
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100
  )
}

export function PastProjectsClient({ projects: initialProjects, deletePastProject }: PastProjectsClientProps) {
  const [projects, setProjects] = useState(initialProjects)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<PastProject | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleFormComplete = () => {
    setShowForm(false)
    setEditingProject(null)
    // Page data will be refreshed by revalidatePath in the server action
    // Reload by refreshing the window
    window.location.reload()
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    startTransition(async () => {
      const result = await deletePastProject(id)
      if (result.error) {
        setDeleteError(result.error)
        setDeletingId(null)
      } else {
        setProjects((prev) => prev.filter((p) => p.id !== id))
        setDeletingId(null)
      }
    })
  }

  if (showForm || editingProject) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {editingProject ? 'Edit Project' : 'Add Project'}
        </h2>
        <PastProjectForm
          project={editingProject ?? undefined}
          onComplete={handleFormComplete}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deleteError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Add Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No past projects added yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Add relevant contract history to strengthen your proposals.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {project.contract_number || 'No contract number'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {project.agency || 'Unknown agency'} &mdash;{' '}
                    {formatCurrency(project.contract_value)}
                  </p>
                  {(project.period_start || project.period_end) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {project.period_start ?? '?'} &ndash; {project.period_end ?? 'present'}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditingProject(project)}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={isPending && deletingId === project.id}
                    className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isPending && deletingId === project.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
