import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('proposal_sections migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/00004_proposal_sections.sql'),
    'utf-8'
  )

  it('creates proposal_sections table with correct columns', () => {
    expect(migration).toContain('create table public.proposal_sections')
    expect(migration).toContain('proposal_id')
    expect(migration).toContain('section_name')
    expect(migration).toContain('content         jsonb')
    expect(migration).toContain('draft_status')
    expect(migration).toContain('last_saved_at')
  })

  it('has unique constraint on proposal_id + section_name', () => {
    expect(migration).toContain('unique (proposal_id, section_name)')
  })

  it('has RLS enabled', () => {
    expect(migration).toContain('enable row level security')
  })

  it('has RLS policy for authenticated users', () => {
    expect(migration).toContain('auth.uid()')
  })

  it('has check constraint on section_name', () => {
    expect(migration).toContain("'Executive Summary'")
    expect(migration).toContain("'Technical Approach'")
    expect(migration).toContain("'Management Plan'")
    expect(migration).toContain("'Past Performance'")
    expect(migration).toContain("'Price Narrative'")
  })

  it('has check constraint on draft_status', () => {
    expect(migration).toContain("'empty'")
    expect(migration).toContain("'generating'")
    expect(migration).toContain("'draft'")
    expect(migration).toContain("'edited'")
  })
})
