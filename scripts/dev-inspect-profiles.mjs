#!/usr/bin/env node
/**
 * Dev diagnostic: list all users with subscription_status='active' and
 * their matching auth.users email, plus all users with admin domain.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnv()

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// All profiles with useful columns
const { data: profiles } = await admin
  .from('profiles')
  .select('id, subscription_status, is_admin')
  .order('subscription_status')

// Look up emails
const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 200 })
const emailFor = new Map(users.map((u) => [u.id, u.email ?? '(no-email)']))

console.log('PROFILES:')
for (const p of profiles ?? []) {
  console.log(
    `  ${p.id}  status=${(p.subscription_status + '       ').slice(0, 10)} admin=${p.is_admin}  email=${emailFor.get(p.id) ?? '(no auth.users row!)'}`,
  )
}

console.log('\nAUTH USERS WITHOUT PROFILE:')
const profileIds = new Set((profiles ?? []).map((p) => p.id))
for (const u of users) {
  if (!profileIds.has(u.id)) {
    console.log(`  ${u.id}  email=${u.email}  created=${u.created_at}`)
  }
}
