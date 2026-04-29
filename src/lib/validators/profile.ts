import { z } from 'zod'

export const CERTIFICATION_OPTIONS = [
  '8(a)',
  'HUBZone',
  'SDVOSB',
  'WOSB',
  'SDB',
] as const

export const CONSTRUCTION_TYPE_OPTIONS = [
  { value: 'building', label: 'Building Construction' },
  { value: 'heavy_civil', label: 'Heavy Civil / Infrastructure' },
  { value: 'highway', label: 'Highway / Transportation' },
  { value: 'residential', label: 'Residential' },
  { value: 'specialty_trade', label: 'Specialty Trade' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical / HVAC / Plumbing' },
  { value: 'environmental', label: 'Environmental / Remediation' },
] as const

export const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'Washington D.C.' },
] as const

export const profileSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  uei_cage: z.string().max(50).optional().or(z.literal('')),
  certifications: z.array(z.enum(CERTIFICATION_OPTIONS)).default([]),
  naics_codes: z.array(z.string().regex(/^\d{6}$/, 'NAICS code must be 6 digits')).default([]),
  capability_statement: z
    .string()
    .max(2000, 'Capability statement must be 2000 characters or less')
    .optional()
    .or(z.literal('')),

  // Business capacity
  annual_revenue_usd: z.number().int().min(0).optional().nullable(),
  bonding_single_usd: z.number().int().min(0).optional().nullable(),
  bonding_aggregate_usd: z.number().int().min(0).optional().nullable(),
  surety_company: z.string().max(200).optional().or(z.literal('')),
  max_project_size_usd: z.number().int().min(0).optional().nullable(),
  employee_count: z.number().int().min(0).optional().nullable(),
  years_in_business: z.number().int().min(0).optional().nullable(),

  // Business type
  construction_types: z.array(z.enum([
    'building', 'heavy_civil', 'highway', 'residential', 'specialty_trade', 'electrical', 'mechanical', 'environmental'
  ])).default([]),
  sba_size_category: z.enum(['small', 'other_than_small']).optional().nullable(),
  sam_gov_registered: z.boolean().default(false),

  // Geography
  primary_state: z.string().max(2).optional().or(z.literal('')),
  geographic_states: z.array(z.string().max(2)).default([]),

  // Onboarding
  onboarding_completed: z.boolean().default(false),

  // Website & identity
  website_url: z.string().url().max(500).optional().or(z.literal('')),
  differentiators: z.string().max(1000).optional().or(z.literal('')),
  emr: z.number().min(0).max(9.99).optional().nullable(),
})

export const pastProjectSchema = z.object({
  contract_number: z.string().max(100).optional().or(z.literal('')),
  agency: z.string().max(200).optional().or(z.literal('')),
  contract_value: z.number().int().min(0).optional(), // cents
  period_start: z.string().optional().or(z.literal('')), // ISO date string
  period_end: z.string().optional().or(z.literal('')),
  scope_narrative: z.string().max(5000).optional().or(z.literal('')),
  naics_code: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
  outcome: z.string().max(2000).optional().or(z.literal('')),
})

export const keyPersonnelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  title: z.string().max(200).optional().or(z.literal('')),
  experience: z.string().max(5000).optional().or(z.literal('')),
  certifications: z.array(z.string().max(100)).default([]),
})

export type ProfileFormData = z.infer<typeof profileSchema>
export type PastProjectFormData = z.infer<typeof pastProjectSchema>
export type KeyPersonnelFormData = z.infer<typeof keyPersonnelSchema>
