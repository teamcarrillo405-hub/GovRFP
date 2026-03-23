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

  it('analyze-proposal Edge Function calls claim_next_job with analysis type', () => {
    const analyzeProposalSrc = readFileSync(
      resolve(process.cwd(), 'supabase/functions/analyze-proposal/index.ts'),
      'utf-8'
    )
    expect(analyzeProposalSrc).toContain('claim_next_job')
    expect(analyzeProposalSrc).toContain("'analysis'")
  })

  it('process-documents enqueues analysis job on success', () => {
    const processDocsSrc = readFileSync(
      resolve(process.cwd(), 'supabase/functions/process-documents/index.ts'),
      'utf-8'
    )
    expect(processDocsSrc).toContain('job_type')
    expect(processDocsSrc).toContain("'analysis'")
    expect(processDocsSrc).toContain("'pending'")
  })
})
