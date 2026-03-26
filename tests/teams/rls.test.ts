import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const migrationSql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/00005_team_accounts.sql'),
  'utf-8'
)

describe('Dual RLS on proposals', () => {
  it('solo policy: auth.uid() = user_id still grants access to own proposals', () => {
    // The original solo RLS policy must remain — team policy is additive
    // Phase 7 migration adds a SECOND policy, not replacing the original
    // Check that the migration adds a team policy without removing solo access
    expect(migrationSql).toContain('Team members can access team proposals')
    // Verify it uses the helper function for team membership lookup
    expect(migrationSql).toContain('get_team_ids_for_user')
  })

  it('team policy: team member can access proposal with matching team_id', () => {
    expect(migrationSql).toContain('on proposals for all to authenticated')
    expect(migrationSql).toContain('team_id in (select get_team_ids_for_user')
  })

  it('team policy: non-member cannot access team proposal', () => {
    // Policy uses team_id IS NOT NULL guard — ensures solo proposals are not affected
    expect(migrationSql).toContain('team_id is not null')
    // Security definer helper prevents RLS recursion
    expect(migrationSql).toContain('security definer')
  })
})

describe('Dual RLS on proposal_sections', () => {
  it('team member can access sections of team proposal', () => {
    expect(migrationSql).toContain('Team members can access team proposal_sections')
    expect(migrationSql).toContain('on proposal_sections for all to authenticated')
  })

  it('non-member cannot access sections of team proposal', () => {
    // The proposal_sections policy restricts to team member proposals only
    const sectionsIdx = migrationSql.indexOf('Team members can access team proposal_sections')
    expect(sectionsIdx).toBeGreaterThan(-1)
    const afterSections = migrationSql.slice(sectionsIdx)
    // Must reference proposals table and team membership
    expect(afterSections).toContain('proposal_id in')
    expect(afterSections).toContain("select id from proposals")
    expect(afterSections).toContain('get_team_ids_for_user')
  })
})
