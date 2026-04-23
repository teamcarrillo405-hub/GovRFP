import { z } from 'zod'
import { SET_ASIDE_CODES } from '@/lib/past-performance/types'

/**
 * Capability Statement — the contractor firm's evergreen identity.
 * Mirrors the public.capability_statements table in migration 00007.
 *
 * "Rich" schema per locked design decision: ~50 fields covering identity,
 * NAICS specialties, certifications, bonding, insurance, financial profile,
 * geographic reach, facilities, equipment, clearances, awards, and vouching
 * contacts. Heterogeneous data lives in JSONB.
 */

export const EMPLOYEE_COUNT_RANGES = [
  '1-10',
  '11-50',
  '51-100',
  '101-250',
  '251-500',
  '500+',
] as const
export type EmployeeCountRange = (typeof EMPLOYEE_COUNT_RANGES)[number]

export const CLEARANCE_LEVELS = ['public_trust', 'secret', 'ts', 'ts_sci'] as const
export type ClearanceLevel = (typeof CLEARANCE_LEVELS)[number]

export const CLEARANCE_LABELS: Record<ClearanceLevel, string> = {
  public_trust: 'Public Trust',
  secret: 'Secret',
  ts: 'Top Secret',
  ts_sci: 'TS/SCI',
}

const annualRevenueEntrySchema = z.object({
  year: z.number().int().min(1900).max(2100),
  revenue_usd: z.number().nonnegative().max(1e12),
})

const facilitySchema = z.object({
  address: z.string().min(1).max(300),
  sqft: z.number().int().nonnegative().max(1e8).optional().nullable(),
  type: z.enum(['office', 'warehouse', 'yard', 'lab', 'manufacturing', 'other']),
})

const equipmentSchema = z.object({
  type: z.string().min(1).max(200),
  capacity: z.string().max(100).optional().nullable(),
  ownership: z.enum(['owned', 'leased', 'rented']),
})

const awardSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.number().int().min(1900).max(2100),
  issuer: z.string().max(200).optional().nullable(),
})

const vouchingContactSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(150).optional().nullable(),
  org: z.string().max(200).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  relationship: z.string().max(300).optional().nullable(),
})

const clearanceCountsSchema = z.object({
  public_trust: z.number().int().nonnegative().optional(),
  secret: z.number().int().nonnegative().optional(),
  ts: z.number().int().nonnegative().optional(),
  ts_sci: z.number().int().nonnegative().optional(),
})

export const capabilityStatementInputSchema = z.object({
  team_id: z.string().uuid().nullable().optional(),

  // Identity
  company_name: z.string().min(1).max(200),
  dba_name: z.string().max(200).optional().nullable(),
  uei: z.string().max(20).optional().nullable(),
  cage_code: z.string().max(10).optional().nullable(),
  duns_number: z.string().max(15).optional().nullable(),
  founding_year: z.number().int().min(1800).max(2100).optional().nullable(),

  // HQ + contact
  hq_address: z.string().max(300).optional().nullable(),
  hq_city: z.string().max(100).optional().nullable(),
  hq_state: z.string().length(2).optional().nullable().or(z.literal('')),
  hq_zip: z.string().max(20).optional().nullable(),
  primary_contact_name: z.string().max(200).optional().nullable(),
  primary_contact_title: z.string().max(150).optional().nullable(),
  primary_contact_email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  primary_contact_phone: z.string().max(50).optional().nullable(),
  website_url: z.string().url().max(300).optional().nullable().or(z.literal('')),

  // Certifications & set-asides (same enum as past_performance for ranker compat)
  certifications: z.array(z.enum(SET_ASIDE_CODES)).max(20).default([]),
  certification_dates: z
    .record(z.string(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .default({}),

  // NAICS
  primary_naics: z.string().regex(/^\d{6}$/).optional().nullable(),
  naics_codes: z.array(z.string().regex(/^\d{6}$/)).max(50).default([]),

  // Narrative + differentiators
  capability_narrative: z.string().max(5000).optional().nullable(),
  differentiators: z.array(z.string().min(1).max(300)).max(10).default([]),

  // Bonding + insurance
  bonding_capacity_single_usd: z.number().nonnegative().max(1e12).optional().nullable(),
  bonding_capacity_aggregate_usd: z.number().nonnegative().max(1e12).optional().nullable(),
  bonding_company: z.string().max(200).optional().nullable(),
  professional_liability_usd: z.number().nonnegative().max(1e12).optional().nullable(),
  general_liability_usd: z.number().nonnegative().max(1e12).optional().nullable(),

  // Financial
  employee_count_range: z.enum(EMPLOYEE_COUNT_RANGES).optional().nullable(),
  annual_revenue: z.array(annualRevenueEntrySchema).max(20).default([]),

  // Geographic
  states_active: z.array(z.string().length(2)).max(60).default([]),
  gsa_regions: z.array(z.string().max(20)).max(15).default([]),

  // Past award summary
  total_contracts_completed: z.number().int().nonnegative().max(1e6).optional().nullable(),
  total_contract_value_usd: z.number().nonnegative().max(1e13).optional().nullable(),

  // Facilities + equipment
  facilities: z.array(facilitySchema).max(50).default([]),
  equipment: z.array(equipmentSchema).max(100).default([]),

  // Clearances
  clearance_counts: clearanceCountsSchema.default({}),

  // Awards + references
  awards: z.array(awardSchema).max(50).default([]),
  vouching_contacts: z.array(vouchingContactSchema).max(20).default([]),
})

export type CapabilityStatementInput = z.infer<typeof capabilityStatementInputSchema>

/** Row shape from DB select * */
export interface CapabilityStatementRow extends CapabilityStatementInput {
  id: string
  user_id: string
  team_id: string | null
  created_at: string
  updated_at: string
}
