'use client'

import { useState } from 'react'
import type { SectionName } from '@/lib/editor/types'

type GapType = 'past_projects' | 'key_personnel' | 'capability_statement'

interface PastProject {
  agency: string
  scope_narrative: string
  contract_value: string
  period_start: string
  period_end: string
  outcome: string
}

interface KeyPerson {
  name: string
  title: string
  experience: string
}

interface Props {
  isOpen: boolean
  sectionName: SectionName
  gaps: GapType[]
  onConfirm: (attachmentContext: string) => void
  onSkip: () => void
  onCancel: () => void
}

function emptyProject(): PastProject {
  return { agency: '', scope_narrative: '', contract_value: '', period_start: '', period_end: '', outcome: '' }
}

function emptyPerson(): KeyPerson {
  return { name: '', title: '', experience: '' }
}

export default function SectionPreflightModal({
  isOpen,
  sectionName,
  gaps,
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const [projects, setProjects] = useState<PastProject[]>([emptyProject()])
  const [personnel, setPersonnel] = useState<KeyPerson[]>([emptyPerson()])
  const [capabilityStatement, setCapabilityStatement] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const needsProjects = gaps.includes('past_projects')
  const needsPersonnel = gaps.includes('key_personnel')
  const needsCapability = gaps.includes('capability_statement')

  const updateProject = (i: number, field: keyof PastProject, value: string) => {
    setProjects((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const updatePerson = (i: number, field: keyof KeyPerson, value: string) => {
    setPersonnel((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const handleSaveAndGenerate = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const body: Record<string, unknown> = {}

      if (needsProjects) {
        const valid = projects.filter((p) => p.agency.trim() && p.scope_narrative.trim())
        if (valid.length === 0) {
          setError('Add at least one past project with agency name and description.')
          setIsSaving(false)
          return
        }
        body.past_projects = valid
      }

      if (needsPersonnel) {
        const valid = personnel.filter((p) => p.name.trim())
        if (valid.length === 0) {
          setError('Add at least one team member with a name.')
          setIsSaving(false)
          return
        }
        body.key_personnel = valid
      }

      if (needsCapability) {
        if (!capabilityStatement.trim()) {
          setError('Please enter your capability statement.')
          setIsSaving(false)
          return
        }
        body.capability_statement = capabilityStatement
      }

      const res = await fetch('/api/user/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed to save')

      // Build attachment context string for this generation pass
      const contextParts: string[] = []

      if (needsProjects) {
        const valid = projects.filter((p) => p.agency.trim() && p.scope_narrative.trim())
        contextParts.push(
          'Past Projects:\n' +
          valid.map((p, i) =>
            `Project ${i + 1}: ${p.agency}` +
            (p.contract_value ? ` | Contract value: $${p.contract_value}` : '') +
            (p.period_start ? ` | Period: ${p.period_start} to ${p.period_end}` : '') +
            `\nDescription: ${p.scope_narrative}` +
            (p.outcome ? `\nOutcome: ${p.outcome}` : '')
          ).join('\n\n')
        )
      }

      if (needsPersonnel) {
        const valid = personnel.filter((p) => p.name.trim())
        contextParts.push(
          'Key Personnel:\n' +
          valid.map((p) =>
            `${p.name}${p.title ? ` — ${p.title}` : ''}` +
            (p.experience ? `\n${p.experience}` : '')
          ).join('\n\n')
        )
      }

      if (needsCapability && capabilityStatement.trim()) {
        contextParts.push(`Capability Statement:\n${capabilityStatement}`)
      }

      onConfirm(contextParts.join('\n\n---\n\n'))
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(15,23,42,0.55)', paddingTop: 40, paddingBottom: 40, overflowY: 'auto' }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full mx-4"
        style={{ maxWidth: 640 }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            Information needed: {sectionName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            We never fabricate details. Provide the real information below so the AI writes accurately about your company.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-8 max-h-[60vh] overflow-y-auto">

          {/* Past Projects */}
          {needsProjects && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Past Performance</h3>
                  <p className="text-xs text-gray-500">Add projects that demonstrate relevant experience for this proposal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProjects((prev) => [...prev, emptyProject()])}
                  className="text-xs font-semibold text-[#2F80FF] hover:underline"
                >
                  + Add project
                </button>
              </div>

              <div className="space-y-4">
                {projects.map((p, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Project {i + 1}
                      </span>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProjects((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Agency or Client Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={p.agency}
                          onChange={(e) => updateProject(i, 'agency', e.target.value)}
                          placeholder="e.g. U.S. Army Corps of Engineers"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description of Work Performed <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={p.scope_narrative}
                          onChange={(e) => updateProject(i, 'scope_narrative', e.target.value)}
                          placeholder="Describe the scope, type of construction, services provided..."
                          rows={3}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Contract Value ($)</label>
                        <input
                          type="text"
                          value={p.contract_value}
                          onChange={(e) => updateProject(i, 'contract_value', e.target.value)}
                          placeholder="e.g. 2500000"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Outcome / Result</label>
                        <input
                          type="text"
                          value={p.outcome}
                          onChange={(e) => updateProject(i, 'outcome', e.target.value)}
                          placeholder="e.g. Completed on time, zero deficiencies"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="month"
                          value={p.period_start}
                          onChange={(e) => updateProject(i, 'period_start', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="month"
                          value={p.period_end}
                          onChange={(e) => updateProject(i, 'period_end', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Key Personnel */}
          {needsPersonnel && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Key Personnel</h3>
                  <p className="text-xs text-gray-500">Add the team members who will perform this work.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPersonnel((prev) => [...prev, emptyPerson()])}
                  className="text-xs font-semibold text-[#2F80FF] hover:underline"
                >
                  + Add person
                </button>
              </div>

              <div className="space-y-4">
                {personnel.map((p, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Person {i + 1}
                      </span>
                      {personnel.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPersonnel((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updatePerson(i, 'name', e.target.value)}
                          placeholder="e.g. Maria Gonzalez"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Title / Role</label>
                        <input
                          type="text"
                          value={p.title}
                          onChange={(e) => updatePerson(i, 'title', e.target.value)}
                          placeholder="e.g. Project Manager"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Qualifications / Experience
                        </label>
                        <textarea
                          value={p.experience}
                          onChange={(e) => updatePerson(i, 'experience', e.target.value)}
                          placeholder="Years of experience, certifications, relevant background..."
                          rows={2}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Capability Statement */}
          {needsCapability && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Capability Statement</h3>
              <p className="text-xs text-gray-500 mb-3">
                A brief description of your company's core competencies and value proposition (max 2,000 characters).
              </p>
              <textarea
                value={capabilityStatement}
                onChange={(e) => setCapabilityStatement(e.target.value)}
                maxLength={2000}
                placeholder="Describe your company's core capabilities, differentiators, and relevant expertise..."
                rows={5}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80FF] focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{capabilityStatement.length}/2000</p>
            </section>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-800"
            >
              Skip — generate anyway
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveAndGenerate}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#2F80FF] hover:bg-[#2568CC] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save & Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
