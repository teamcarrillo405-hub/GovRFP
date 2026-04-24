import Link from 'next/link'
import type { RfpAnalysis } from '@/lib/analysis/types'
import type { CapabilityStatementRow } from '@/lib/capability-statement/types'
import {
  checkSizeEligibilityFromCapStatement,
  type SizeEligibility,
} from '@/lib/sba/size-standards'

interface Props {
  analysis: RfpAnalysis
  capabilityStatement: CapabilityStatementRow | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract up to 3 NAICS codes from the analysis.
 *
 * Strategy (in priority order):
 *  1. rfp_analysis.naics_codes — extracted from the raw PDF by Claude (new, primary)
 *  2. win_factors.naics — single NAICS from GovRFP handoff (legacy fallback)
 *
 * The primary path covers raw PDF uploads; the fallback covers proposals that
 * arrived via the GovRFP bridge before the analysis edge function ran.
 */
function extractNaicsCodes(analysis: RfpAnalysis): { codes: string[]; fromAnalysis: boolean } {
  // 1. Primary: dedicated naics_codes column populated by analyze-proposal edge function
  if (Array.isArray(analysis.naics_codes) && analysis.naics_codes.length > 0) {
    const valid = analysis.naics_codes
      .filter((c) => typeof c === 'string' && /^\d{6}$/.test(c))
      .slice(0, 3)
    if (valid.length > 0) return { codes: valid, fromAnalysis: true }
  }

  // 2. Fallback: win_factors.naics from GovRFP handoff (single code stored in JSONB)
  const wf = analysis.win_factors as unknown as Record<string, unknown> | null
  if (wf && typeof wf.naics === 'string' && /^\d{6}$/.test(wf.naics)) {
    return { codes: [wf.naics], fromAnalysis: false }
  }

  return { codes: [], fromAnalysis: false }
}

/**
 * Derive a human-readable set-aside label from the detected set-asides array.
 * Returns null when the RFP is open competition (no set-asides detected).
 */
function setAsideLabel(setAsidesDetected: string[]): string | null {
  if (!setAsidesDetected || setAsidesDetected.length === 0) return null
  // Format first detected set-aside; show "+ N more" if multiple
  const first = setAsidesDetected[0]
  const rest = setAsidesDetected.length - 1
  return rest > 0 ? `${first} (+${rest} more)` : first
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: SizeEligibility['status'] }) {
  if (status === 'eligible') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 border border-green-300">
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Eligible
      </span>
    )
  }
  if (status === 'ineligible') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-300">
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Ineligible
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-300">
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Unknown
    </span>
  )
}

function NaicsRow({ eligibility }: { eligibility: SizeEligibility }) {
  const { naics, standard, status, margin } = eligibility
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-gray-900 tabular-nums">{naics}</span>
          <span className="text-xs text-gray-500 truncate">{standard.description}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Threshold:{' '}
          <span style={{ color: 'var(--hcc-orange)' }} className="font-semibold">
            {standard.threshold_label}
          </span>
          {standard.threshold_type === 'employees' ? ' employees' : ' annual revenue'}
          {margin && (
            <span className="ml-2 text-gray-500">({margin})</span>
          )}
        </p>
      </div>
      <div className="flex-shrink-0">
        <StatusPill status={status} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SizeEligibilityCard({ analysis, capabilityStatement }: Props) {
  const { codes: naicsCodes, fromAnalysis } = extractNaicsCodes(analysis)
  const setAside = setAsideLabel(analysis.set_asides_detected)
  const hasCapStatement = capabilityStatement !== null

  // Compute eligibility for each detected NAICS code
  const eligibilityResults: SizeEligibility[] = naicsCodes.map((naics) =>
    checkSizeEligibilityFromCapStatement(
      naics,
      capabilityStatement?.employee_count_range ?? null,
      capabilityStatement?.annual_revenue ?? null,
    ),
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">SBA Size Eligibility</h3>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            13 CFR Part 121
          </span>
        </div>
      </div>

      {/* Set-aside type row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Set-Aside
        </span>
        {setAside ? (
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-300">
            {setAside}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">
            Open Competition — no size restriction
          </span>
        )}
      </div>

      {/* NAICS eligibility rows */}
      {naicsCodes.length === 0 ? (
        <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          No NAICS code detected in this RFP.{' '}
          {!hasCapStatement && (
            <>
              <Link
                href="/capability-statement"
                className="font-medium underline"
                style={{ color: 'var(--hcc-orange)' }}
              >
                Complete your capability statement
              </Link>{' '}
              to enable eligibility checks when NAICS codes are present.
            </>
          )}
        </div>
      ) : (
        <>
          {fromAnalysis && naicsCodes.length > 1 && (
            <p className="mb-3 text-xs text-gray-500">
              Based on detected NAICS codes from RFP analysis. Showing top {naicsCodes.length} by relevance.
            </p>
          )}
          <div className="divide-y divide-gray-100">
            {eligibilityResults.map((elig) => (
              <NaicsRow key={elig.naics} eligibility={elig} />
            ))}
          </div>
        </>
      )}

      {/* Unknown-data prompt */}
      {!hasCapStatement && naicsCodes.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Capability statement not found.</span>{' '}
          <Link
            href="/capability-statement"
            className="font-medium underline"
            style={{ color: 'var(--hcc-orange)' }}
          >
            Complete your capability statement
          </Link>{' '}
          to see revenue- and headcount-based eligibility.
        </div>
      )}

      {/* Partial data warning */}
      {hasCapStatement && naicsCodes.length > 0 && eligibilityResults.some((e) => e.status === 'unknown') && (
        <p className="mt-3 text-xs text-gray-500">
          Some checks show Unknown because employee count or annual revenue is missing.{' '}
          <Link
            href="/capability-statement"
            className="underline"
            style={{ color: 'var(--hcc-orange)' }}
          >
            Update capability statement
          </Link>
        </p>
      )}
    </div>
  )
}
