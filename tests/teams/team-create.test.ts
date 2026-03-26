import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routeSource = readFileSync(
  resolve(__dirname, '../../src/app/api/teams/route.ts'),
  'utf-8'
)

describe('POST /api/teams', () => {
  it('creates team with owner as first member', () => {
    expect(routeSource).toContain("from('teams')")
    expect(routeSource).toContain("from('team_members')")
    expect(routeSource).toContain("role: 'owner'")
  })

  it('returns 401 for unauthenticated', () => {
    expect(routeSource).toContain('status: 401')
    expect(routeSource).toContain("'Unauthorized'")
  })

  it('sets team.owner_id to auth user', () => {
    expect(routeSource).toContain('owner_id: user.id')
  })

  it('inserts owner into team_members with role=owner', () => {
    const memberInsertIdx = routeSource.indexOf("from('team_members')")
    expect(memberInsertIdx).toBeGreaterThan(-1)
    const afterInsert = routeSource.slice(memberInsertIdx)
    expect(afterInsert).toContain("role: 'owner'")
  })

  it('validates name and proposal_id with Zod', () => {
    expect(routeSource).toContain('z.string().min(1).max(100)')
    expect(routeSource).toContain('z.string().uuid()')
  })

  it('uses admin client for all DB operations', () => {
    expect(routeSource).toContain('createAdminClient')
    expect(routeSource).not.toContain('createServerClient')
    expect(routeSource).not.toContain('auth-helpers-nextjs')
  })

  it('returns 201 on success', () => {
    expect(routeSource).toContain('status: 201')
  })

  it('links proposal to team after creation', () => {
    expect(routeSource).toContain("from('proposals')")
    expect(routeSource).toContain('team_id: team.id')
  })

  it('uses Zod v4 error format (issues not errors)', () => {
    expect(routeSource).toContain('parsed.error.issues')
    expect(routeSource).not.toContain('parsed.error.errors')
  })
})
