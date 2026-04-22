'use client'

import { useState, useTransition } from 'react'
import { createProposalFromGovRfp, type GovRfpHandoffInput } from '@/app/(dashboard)/proposals/new/actions'

interface Props {
  metadata: GovRfpHandoffInput
}

/**
 * Renders the "Pre-filled from GovRFP" panel on /proposals/new when the
 * user arrived via the GovRFP "Send to ProposalAI" button.
 *
 * Shows the metadata, lets the user confirm/create a draft proposal,
 * or fall back to the standard file-upload flow.
 */
export function GovRfpHandoffPanel({ metadata }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onCreate = () => {
    setError(null)
    startTransition(async () => {
      try {
        await createProposalFromGovRfp(metadata)
        // Server action redirects on success, so this line only runs on error
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create proposal')
      }
    })
  }

  const fmtDeadline = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="mb-8 border-2 rounded-lg overflow-hidden" style={{ borderColor: '#F5C518' }}>
      <div
        className="px-5 py-3 flex items-center gap-2 text-sm font-semibold text-gray-900"
        style={{ backgroundColor: '#FFFBEB' }}
      >
        <span
          className="inline-block w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: '#F5C518', color: '#111111' }}
          aria-hidden="true"
        >
          ✓
        </span>
        Pre-filled from GovRFP
      </div>

      <div className="p-5 bg-white space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{metadata.title}</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {metadata.solicitation && (
            <Field label="Solicitation #" value={metadata.solicitation} mono />
          )}
          {metadata.agency && <Field label="Agency" value={metadata.agency} />}
          {metadata.naics && <Field label="NAICS" value={metadata.naics} mono />}
          {metadata.set_aside && <Field label="Set-aside" value={metadata.set_aside} />}
          {metadata.deadline && (
            <Field label="Response deadline" value={fmtDeadline(metadata.deadline)} />
          )}
          {metadata.pop_state && (
            <Field label="Place of performance" value={metadata.pop_state} />
          )}
        </dl>

        {metadata.scope && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Scope summary (from GovRFP)
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-l-2 border-gray-200 pl-3">
              {metadata.scope}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              This is a summary. Upload the full RFP PDF on the next page to extract
              the complete scope, requirements, Sections L/M, and compliance matrix.
            </p>
          </div>
        )}

        {metadata.source_url && (
          <p className="text-xs">
            <a
              href={metadata.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-700 hover:text-yellow-900 underline"
            >
              Source portal →
            </a>
          </p>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={isPending}
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-md text-gray-900 disabled:opacity-50"
            style={{ backgroundColor: '#F5C518' }}
          >
            {isPending ? 'Creating draft…' : 'Create proposal from this opportunity →'}
          </button>
          <p className="text-xs text-gray-500 self-center">
            Then upload the full RFP PDF on the proposal page for OCR + analysis.
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</dt>
      <dd className={`text-gray-900 mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
