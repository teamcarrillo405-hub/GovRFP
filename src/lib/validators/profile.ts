import { z } from 'zod'

export const CERTIFICATION_OPTIONS = [
  '8(a)',
  'HUBZone',
  'SDVOSB',
  'WOSB',
  'SDB',
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
