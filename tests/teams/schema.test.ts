import { describe, it, expect } from 'vitest'
import fs from 'fs'

describe('00005_team_accounts migration', () => {
  const migration = fs.readFileSync('supabase/migrations/00005_team_accounts.sql', 'utf-8')

  it('creates teams table with id, owner_id, name, seat_count, created_at, updated_at', () => {
    expect(migration).toContain('create table public.teams')
    expect(migration).toContain('owner_id')
    expect(migration).toContain('seat_count')
    expect(migration).toContain('created_at')
    expect(migration).toContain('updated_at')
  })

  it('creates team_members table with id, team_id, user_id, role, joined_at, unique(team_id,user_id)', () => {
    expect(migration).toContain('create table public.team_members')
    expect(migration).toContain('joined_at')
    expect(migration).toMatch(/unique\s*\(\s*team_id\s*,\s*user_id\s*\)/)
  })

  it('creates team_invites table with id, team_id, invited_by, invitee_email, role, status, created_at, accepted_at, unique(team_id,invitee_email)', () => {
    expect(migration).toContain('create table public.team_invites')
    expect(migration).toContain('invited_by')
    expect(migration).toContain('invitee_email')
    expect(migration).toContain('accepted_at')
    expect(migration).toMatch(/unique\s*\(\s*team_id\s*,\s*invitee_email\s*\)/)
  })

  it('adds team_id nullable FK to proposals table', () => {
    expect(migration).toMatch(/alter\s+table\s+public\.proposals/)
    expect(migration).toMatch(/add\s+column\s+team_id/)
    expect(migration).toContain('on delete set null')
  })

  it('creates get_team_ids_for_user() SECURITY DEFINER function', () => {
    expect(migration).toContain('get_team_ids_for_user')
    expect(migration).toMatch(/security\s+definer/i)
  })

  it('creates performance indexes on team_members(user_id), team_members(team_id), team_invites(team_id), team_invites(invitee_email), proposals(team_id)', () => {
    expect(migration).toMatch(/create\s+index\s+on\s+team_members\s*\(\s*user_id\s*\)/)
    expect(migration).toMatch(/create\s+index\s+on\s+team_members\s*\(\s*team_id\s*\)/)
    expect(migration).toMatch(/create\s+index\s+on\s+team_invites\s*\(\s*team_id\s*\)/)
    expect(migration).toMatch(/create\s+index\s+on\s+team_invites\s*\(\s*invitee_email\s*\)/)
    expect(migration).toMatch(/create\s+index\s+on\s+proposals\s*\(\s*team_id\s*\)/)
  })
})
