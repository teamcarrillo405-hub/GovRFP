'use client'

import { useRef, useState, useTransition } from 'react'
import { createKeyPersonnel, updateKeyPersonnel } from '@/app/(dashboard)/profile/key-personnel/actions'

interface KeyPerson {
  id: string
  name: string
  title: string | null
  experience: string | null
  certifications: string[] | null
}

interface KeyPersonnelFormProps {
  person?: KeyPerson
  onComplete: () => void
}

export function KeyPersonnelForm({ person, onComplete }: KeyPersonnelFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = person
        ? await updateKeyPersonnel(person.id, formData)
        : await createKeyPersonnel(formData)
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

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={person?.name ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Jane Smith"
        />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={person?.title ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Project Manager / Senior Engineer"
        />
      </div>

      {/* Certifications */}
      <div>
        <label htmlFor="certifications" className="block text-sm font-medium text-gray-700 mb-1">
          Certifications
        </label>
        <input
          id="certifications"
          name="certifications"
          type="text"
          defaultValue={person?.certifications?.join(', ') ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="PMP, PE, LEED AP (comma-separated)"
        />
      </div>

      {/* Relevant Experience */}
      <div>
        <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
          Relevant Experience
        </label>
        <textarea
          id="experience"
          name="experience"
          rows={5}
          defaultValue={person?.experience ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="Describe relevant experience, past government contracts, technical expertise..."
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
          {isPending ? 'Saving...' : person ? 'Update' : 'Add Personnel'}
        </button>
      </div>
    </form>
  )
}
