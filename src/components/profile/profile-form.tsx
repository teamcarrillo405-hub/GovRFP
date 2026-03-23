'use client'

import { useRef, useState, useTransition } from 'react'
import { updateProfile } from '@/app/(dashboard)/profile/actions'
import { CERTIFICATION_OPTIONS } from '@/lib/validators/profile'
import type { ProfileFormData } from '@/lib/validators/profile'

interface ProfileFormProps {
  initialData: Partial<ProfileFormData> | null
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [charCount, setCharCount] = useState(
    initialData?.capability_statement?.length ?? 0
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setMessage(null)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Profile saved successfully.' })
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Company Name */}
      <div>
        <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          id="company_name"
          name="company_name"
          type="text"
          required
          defaultValue={initialData?.company_name ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Acme Contracting LLC"
        />
      </div>

      {/* UEI / CAGE */}
      <div>
        <label htmlFor="uei_cage" className="block text-sm font-medium text-gray-700 mb-1">
          UEI / CAGE Code
        </label>
        <input
          id="uei_cage"
          name="uei_cage"
          type="text"
          defaultValue={initialData?.uei_cage ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. ABC123456789"
        />
      </div>

      {/* Certifications */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Certifications
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CERTIFICATION_OPTIONS.map((cert) => (
            <label key={cert} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="certifications"
                value={cert}
                defaultChecked={initialData?.certifications?.includes(cert) ?? false}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {cert}
            </label>
          ))}
        </div>
      </fieldset>

      {/* NAICS Codes */}
      <div>
        <label htmlFor="naics_codes" className="block text-sm font-medium text-gray-700 mb-1">
          NAICS Codes
        </label>
        <input
          id="naics_codes"
          name="naics_codes"
          type="text"
          defaultValue={initialData?.naics_codes?.join(', ') ?? ''}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="236220, 541611 (comma-separated 6-digit codes)"
        />
        <p className="mt-1 text-xs text-gray-500">Enter comma-separated 6-digit NAICS codes.</p>
      </div>

      {/* Capability Statement */}
      <div>
        <label htmlFor="capability_statement" className="block text-sm font-medium text-gray-700 mb-1">
          Capability Statement
        </label>
        <textarea
          id="capability_statement"
          name="capability_statement"
          rows={8}
          maxLength={2000}
          defaultValue={initialData?.capability_statement ?? ''}
          onChange={(e) => setCharCount(e.target.value.length)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          placeholder="Describe your company's core competencies, differentiators, and relevant experience..."
        />
        <p className="mt-1 text-xs text-gray-500 text-right">{charCount}/2000</p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
