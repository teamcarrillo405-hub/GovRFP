import { z } from 'zod'

/**
 * GovRFP → ProposalAI bridge: schema + parser.
 *
 * Matches the URL builder in:
 *   contractor-rfp-website/lib/bridge/buildProposalAiUrl.ts
 *
 * Two exports for two use-cases:
 *   - parseGovRfpHandoff(searchParams) — LENIENT read from URL. Silently
 *     drops malformed OPTIONAL fields (naics/pop_state/source_url) so a
 *     sender typo on one field doesn't blow up the whole workflow. Returns
 *     null only when the sentinel or REQUIRED fields are missing/invalid.
 *   - govRfpHandoffSchema — STRICT zod for the server action. Defense in
 *     depth: the parser already sanitized, but the action re-validates at
 *     the trust boundary before DB writes.
 *
 * Contract:
 *   Required — source=govrfp, govrfp_id (UUID), title (1–200 chars)
 *   Optional — solicitation, agency, naics (^\d{6}$), set_aside,
 *             deadline, pop_state (2 chars), source_url (http[s]),
 *             scope (≤ PARSER_SCOPE_LIMIT; sender caps at 1500, parser
 *             keeps 500 chars of slack)
 */

export const PARSER_SCOPE_LIMIT = 2000

export const govRfpHandoffSchema = z.object({
  govrfp_id: z.string().uuid(),
  solicitation: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  agency: z.string().max(200).optional(),
  naics: z.string().regex(/^\d{6}$/).optional(),
  set_aside: z.string().max(50).optional(),
  deadline: z.string().optional(),
  pop_state: z.string().length(2).optional(),
  source_url: z.string().url().optional(),
  scope: z.string().max(PARSER_SCOPE_LIMIT).optional(),
})

export type GovRfpHandoffInput = z.infer<typeof govRfpHandoffSchema>

export interface RawGovRfpSearchParams {
  source?: string
  govrfp_id?: string
  solicitation?: string
  title?: string
  agency?: string
  naics?: string
  set_aside?: string
  deadline?: string
  pop_state?: string
  source_url?: string
  scope?: string
}

export function parseGovRfpHandoff(
  params: RawGovRfpSearchParams,
): GovRfpHandoffInput | null {
  if (params.source !== 'govrfp') return null

  const candidate = {
    govrfp_id: params.govrfp_id,
    solicitation: params.solicitation,
    title: params.title,
    agency: params.agency,
    // Drop bad optional fields silently — schema sees only undefined or valid
    naics: params.naics?.match(/^\d{6}$/) ? params.naics : undefined,
    set_aside: params.set_aside,
    deadline: params.deadline,
    pop_state: params.pop_state?.length === 2 ? params.pop_state : undefined,
    source_url:
      params.source_url && /^https?:\/\//.test(params.source_url)
        ? params.source_url
        : undefined,
    scope: params.scope,
  }

  const parsed = govRfpHandoffSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
