'use client'

import { useState, useTransition } from 'react'
import { KeyPersonnelForm } from './key-personnel-form'

interface KeyPerson {
  id: string
  name: string
  title: string | null
  experience: string | null
  certifications: string[] | null
}

interface KeyPersonnelClientProps {
  personnel: KeyPerson[]
  deleteKeyPersonnel: (id: string) => Promise<{ success?: boolean; error?: string }>
}

export function KeyPersonnelClient({ personnel: initialPersonnel, deleteKeyPersonnel }: KeyPersonnelClientProps) {
  const [personnel, setPersonnel] = useState(initialPersonnel)
  const [showForm, setShowForm] = useState(false)
  const [editingPerson, setEditingPerson] = useState<KeyPerson | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleFormComplete = () => {
    setShowForm(false)
    setEditingPerson(null)
    window.location.reload()
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteKeyPersonnel(id)
      if (result.error) {
        setDeleteError(result.error)
        setDeletingId(null)
      } else {
        setPersonnel((prev) => prev.filter((p) => p.id !== id))
        setDeletingId(null)
      }
    })
  }

  if (showForm || editingPerson) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {editingPerson ? 'Edit Personnel' : 'Add Personnel'}
        </h2>
        <KeyPersonnelForm
          person={editingPerson ?? undefined}
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
          Add Personnel
        </button>
      </div>

      {personnel.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No key personnel added yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Add team member bios to include in proposal sections.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {personnel.map((person) => (
            <li key={person.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{person.name}</p>
                  {person.title && (
                    <p className="text-sm text-gray-600">{person.title}</p>
                  )}
                  {person.certifications && person.certifications.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {person.certifications.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditingPerson(person)}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(person.id)}
                    disabled={isPending && deletingId === person.id}
                    className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isPending && deletingId === person.id ? 'Deleting...' : 'Delete'}
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
