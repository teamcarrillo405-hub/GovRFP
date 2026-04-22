/**
 * GovRFP → ProposalAI bridge: return-trip helpers.
 *
 * Companion to govrfp-handoff.ts. When a proposal was created via the GovRFP
 * "Send to ProposalAI" flow, the server action stored metadata on
 * rfp_analysis.win_factors with `govrfp_handoff: true`. These helpers read
 * that metadata back and build a URL linking to the source opportunity on
 * GovRFP — so the UI can render a "View in GovRFP" affordance.
 *
 * Companion sender in contractor-rfp-website/lib/bridge/buildProposalAiUrl.ts
 * defaults to http://localhost:3004 (ProposalAI). This module defaults to
 * http://localhost:3000 (GovRFP) — symmetric dev-port assumption.
 */

export const DEFAULT_GOVRFP_URL = 'http://localhost:3000'

export interface GovRfpSource {
  /** The UUID of the opportunity row in GovRFP's `opportunities` table. */
  opportunityId: string
}

/**
 * Reads the handoff metadata off rfp_analysis.win_factors.
 *
 * The win_factors column is JSONB and carries two mutually-exclusive shapes:
 *   1. The standard ANALYZE-03 WinFactors interface (scope_alignment, etc.)
 *   2. The GovRFP handoff shape ({ govrfp_handoff: true, govrfp_opportunity_id })
 *
 * This helper safely narrows the unknown blob to shape #2 or returns null.
 * Accepts any input (including null/undefined/non-objects) so callers can
 * feed in `proposal.rfp_analysis?.win_factors` without pre-checking.
 */
export function extractGovRfpSource(winFactors: unknown): GovRfpSource | null {
  if (!winFactors || typeof winFactors !== 'object') return null
  const wf = winFactors as Record<string, unknown>
  if (wf.govrfp_handoff !== true) return null
  const id = wf.govrfp_opportunity_id
  if (typeof id !== 'string' || id.length === 0) return null
  return { opportunityId: id }
}

/**
 * Builds the URL pointing at an opportunity's detail page on GovRFP.
 * Symmetric to contractor-rfp-website's buildProposalAiUrl(): pure, no
 * env/DOM reads, fully unit-testable.
 */
export function buildGovRfpOpportunityUrl(
  opportunityId: string,
  govrfpBaseUrl: string = DEFAULT_GOVRFP_URL,
): string {
  // Trim trailing slashes so we don't end up with //opportunities/...
  const base = govrfpBaseUrl.replace(/\/+$/, '')
  return `${base}/opportunities/${opportunityId}`
}
