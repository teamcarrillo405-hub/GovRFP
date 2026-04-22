import { z } from 'zod'

/**
 * Past Performance record — FAR 15.305 past-performance evidence.
 *
 * Mirrors the public.past_performance table in migration 00006. The
 * scope_narrative is evergreen — the LLM tailors it per proposal at draft
 * time, so keep it general and fact-focused rather than RFP-specific.
 */

export const CPARS_RATINGS = [
  'exceptional',
  'very_good',
  'satisfactory',
  'marginal',
  'unsatisfactory',
] as const

export type CparsRating = (typeof CPARS_RATINGS)[number]

export const CPARS_LABELS: Record<CparsRating, string> = {
  exceptional: 'Exceptional',
  very_good: 'Very Good',
  satisfactory: 'Satisfactory',
  marginal: 'Marginal',
  unsatisfactory: 'Unsatisfactory',
}

const keyPersonnelSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  still_with_firm: z.boolean().default(true),
})

export type KeyPersonnel = z.infer<typeof keyPersonnelSchema>

/**
 * Input shape for creating/updating a PP record. Server actions accept this,
 * run safeParse, and write to the DB. user_id comes from the session; id,
 * created_at, updated_at are DB-managed.
 */
export const pastPerformanceInputSchema = z.object({
  team_id: z.string().uuid().nullable().optional(),

  contract_title: z.string().min(1).max(300),
  contract_number: z.string().max(100).optional().nullable(),
  customer_name: z.string().min(1).max(200),
  customer_agency_code: z.string().max(50).optional().nullable(),
  customer_poc_name: z.string().max(200).optional().nullable(),
  customer_poc_email: z.string().email().max(200).optional().nullable().or(z.literal('')),

  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  contract_value_usd: z.number().nonnegative().max(1e12).optional().nullable(),
  naics_codes: z.array(z.string().regex(/^\d{6}$/)).max(20).default([]),
  set_asides_claimed: z.array(z.string().max(50)).max(20).default([]),

  scope_narrative: z.string().min(1).max(5000),
  key_personnel: z.array(keyPersonnelSchema).max(20).default([]),
  outcomes: z.string().max(2000).optional().nullable(),
  cpars_rating: z.enum(CPARS_RATINGS).optional().nullable(),

  tags: z.array(z.string().max(50)).max(30).default([]),
})
.refine(
  (d) => !(d.period_start && d.period_end && d.period_start > d.period_end),
  { message: 'period_end must be on or after period_start', path: ['period_end'] },
)

export type PastPerformanceInput = z.infer<typeof pastPerformanceInputSchema>

/**
 * Row shape as returned from the DB (select *). Mirrors
 * PastPerformanceInput plus DB-managed fields. Used for typing query
 * results, not for validation.
 */
export interface PastPerformanceRow
  extends Omit<PastPerformanceInput, 'team_id' | 'customer_poc_email'> {
  id: string
  user_id: string
  team_id: string | null
  customer_poc_email: string | null
  created_at: string
  updated_at: string
  /** 1536-dim embedding of scope_narrative, populated async. Null until embed job runs. */
  relevance_embedding: number[] | null
}

/**
 * Well-known set-aside codes contractors claim. Matches the SAM.gov enum
 * GovRFP uses for opportunities, so ranking against rfp_analysis.set_asides_detected
 * is a direct array intersection.
 */
export const SET_ASIDE_CODES = [
  'SBA',    // Total Small Business
  '8A',     // 8(a) Competitive
  '8AN',    // 8(a) Sole Source
  'HZC',    // HUBZone Competitive
  'HZS',    // HUBZone Sole Source
  'SDVOSBC',// SDVOSB Competitive
  'SDVOSBS',// SDVOSB Sole Source
  'WOSB',   // WOSB Competitive
  'EDWOSB', // EDWOSB Competitive
  'VSA',    // Veteran Small Business
] as const

export type SetAsideCode = (typeof SET_ASIDE_CODES)[number]
