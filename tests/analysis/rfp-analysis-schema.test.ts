import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('rfp_analysis migration schema', () => {
  it('creates rfp_analysis table', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain('rfp_analysis')
    expect(migration).toContain('requirements')
    expect(migration).toContain('compliance_matrix')
    expect(migration).toContain('win_score')
    expect(migration).toContain('win_factors')
  })

  it('adds GIN indexes for JSONB querying', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration.toLowerCase()).toContain('gin')
  })

  it('updates proposals.status constraint to include analyzed', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain("'analyzed'")
    expect(migration).toContain('proposals_status_check')
  })

  it('enables RLS on rfp_analysis', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/00003_rfp_analysis.sql'),
      'utf-8'
    )
    expect(migration).toContain('enable row level security')
  })
})
