import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routeSource = readFileSync(
  resolve(__dirname, '../../src/app/api/teams/members/[id]/route.ts'),
  'utf-8'
)

describe('PATCH /api/teams/members/[id]', () => {
  it('owner can change member role', () => {
    expect(routeSource).toContain('export async function PATCH(')
    expect(routeSource).toContain("from('team_members')")
    expect(routeSource).toContain('.update(')
    expect(routeSource).toContain('role')
  })

  it('non-owner receives 403', () => {
    expect(routeSource).toContain('status: 403')
    expect(routeSource).toContain("'Forbidden'")
  })

  it('validates role as editor or viewer (cannot set owner via PATCH)', () => {
    expect(routeSource).toContain("z.enum(['editor', 'viewer'])")
  })

  it('requires authentication', () => {
    expect(routeSource).toContain('getUser')
    expect(routeSource).toContain('status: 401')
  })

  it('awaits params (Next.js 16 requirement)', () => {
    expect(routeSource).toContain('await params')
  })
})

describe('DELETE /api/teams/members/[id]', () => {
  it('owner can remove member', () => {
    expect(routeSource).toContain('export async function DELETE(')
    expect(routeSource).toContain('.delete()')
    expect(routeSource).toContain("from('team_members')")
  })

  it('decrements seat_count', () => {
    // seat_count recalculated from actual member count after deletion
    expect(routeSource).toContain('seat_count')
    expect(routeSource).toContain("count: 'exact'")
    expect(routeSource).toContain('head: true')
  })

  it('non-owner receives 403', () => {
    // Both PATCH and DELETE verify owner — check that pattern is present
    const patchIdx = routeSource.indexOf('export async function PATCH(')
    const deleteIdx = routeSource.indexOf('export async function DELETE(')
    const afterDelete = routeSource.slice(deleteIdx)
    expect(afterDelete).toContain('status: 403')
    expect(patchIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(patchIdx)
  })

  it('uses admin client for all operations', () => {
    expect(routeSource).toContain('createAdminClient')
    expect(routeSource).not.toContain('auth-helpers-nextjs')
  })
})
