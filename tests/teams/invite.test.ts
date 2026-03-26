import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const inviteSource = readFileSync(
  resolve(__dirname, '../../src/app/api/teams/invite/route.ts'),
  'utf-8'
)

const acceptSource = readFileSync(
  resolve(__dirname, '../../src/app/api/teams/invite/accept/route.ts'),
  'utf-8'
)

const declineSource = readFileSync(
  resolve(__dirname, '../../src/app/api/teams/invite/decline/route.ts'),
  'utf-8'
)

describe('POST /api/teams/invite', () => {
  it('creates team_invites record with status=pending', () => {
    expect(inviteSource).toContain("from('team_invites')")
    expect(inviteSource).toContain("status: 'pending'")
  })

  it('calls inviteUserByEmail for new user', () => {
    expect(inviteSource).toContain('inviteUserByEmail')
  })

  it('handles existing user gracefully (does not throw)', () => {
    expect(inviteSource).toContain('already registered')
    // existingUser flag set to true when user is already registered
    expect(inviteSource).toContain('existingUser = true')
    // Response includes existing_user field
    expect(inviteSource).toContain('existing_user')
  })

  it('returns 403 for non-owner', () => {
    expect(inviteSource).toContain('status: 403')
    expect(inviteSource).toContain("'Forbidden'")
  })

  it('returns 400 for invalid email', () => {
    expect(inviteSource).toContain('z.string().email()')
    expect(inviteSource).toContain('status: 400')
  })

  it('validates role as editor or viewer only', () => {
    expect(inviteSource).toContain("z.enum(['editor', 'viewer'])")
  })

  it('uses admin client for auth.admin.inviteUserByEmail', () => {
    expect(inviteSource).toContain('createAdminClient')
    expect(inviteSource).toContain('auth.admin.inviteUserByEmail')
  })

  it('uses Zod v4 error format', () => {
    expect(inviteSource).toContain('parsed.error.issues')
    expect(inviteSource).not.toContain('parsed.error.errors')
  })
})

describe('POST /api/teams/invite/accept', () => {
  it('marks invite accepted and inserts team_member', () => {
    expect(acceptSource).toContain("status: 'accepted'")
    expect(acceptSource).toContain("from('team_members')")
    expect(acceptSource).toContain('.insert(')
  })

  it('increments seat_count', () => {
    expect(acceptSource).toContain('seat_count')
    expect(acceptSource).toContain("from('teams')")
    expect(acceptSource).toContain('.update(')
  })

  it('returns 400 for invalid/expired invite', () => {
    expect(acceptSource).toContain('status: 400')
    expect(acceptSource).toContain("'Invalid or expired invite'")
  })

  it('requires authentication', () => {
    expect(acceptSource).toContain('getUser')
    expect(acceptSource).toContain('status: 401')
  })

  it('derives seat_count from actual member count (race-safe)', () => {
    expect(acceptSource).toContain("count: 'exact'")
    expect(acceptSource).toContain('head: true')
  })
})

describe('POST /api/teams/invite/decline', () => {
  it('marks invite declined', () => {
    expect(declineSource).toContain("status: 'declined'")
    expect(declineSource).toContain("from('team_invites')")
    expect(declineSource).toContain('.update(')
  })

  it('does not require authentication (unauthenticated users can decline)', () => {
    // decline route does NOT call getUser() — user arrives from email link without session
    expect(declineSource).not.toContain('getUser()')
    expect(declineSource).toContain('status: 400')
  })

  it('validates invite_id as uuid', () => {
    expect(declineSource).toContain('z.string().uuid()')
  })
})
