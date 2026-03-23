import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('document_jobs job_type extension', () => {
  it('migration adds job_type column with default "document"', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain('job_type')
    expect(migration).toContain("default 'document'")
  })

  it('migration creates claim_next_job function with p_job_type parameter', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain('claim_next_job')
    expect(migration).toContain('p_job_type')
  })

  it('migration retains claim_next_document_job as backward-compat alias', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain('claim_next_document_job')
  })

  it('migration adds analysis to the job_type check constraint', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain("'analysis'")
  })
})
