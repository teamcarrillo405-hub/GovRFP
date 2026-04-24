#!/usr/bin/env node
/**
 * dev-activate-subscription.mjs
 *
 * Dev-only: flip a user's profiles.subscription_status to 'active' so the
 * GovRFP "Send to ProposalAI" button un-disables and ProposalAI's
 * isSubscriptionActive() returns true.
 *
 * NOT for production. Bypasses Stripe entirely. Uses the service-role key
 * to write directly.
 *
 * Usage: node scripts/dev-activate-subscription.mjs <email>
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Tiny .env.local reader — no dotenv dep needed
function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

loadEnv()

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/dev-activate-subscription.mjs <email>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

console.log(`→ Looking up auth user for ${email}...`)
// admin.listUsers pages in batches of 50; email match is case-insensitive in Supabase
const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 })
if (listErr) {
  console.error('listUsers failed:', listErr.message)
  process.exit(1)
}
const user = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  console.error(`  user not found (first ${usersPage.users.length} users scanned)`)
  process.exit(1)
}
console.log(`  found: id=${user.id}, created_at=${user.created_at}`)

console.log(`→ Reading current profile row...`)
const { data: before, error: readErr } = await admin
  .from('profiles')
  .select('id, subscription_status, is_admin, stripe_customer_id')
  .eq('id', user.id)
  .maybeSingle()
if (readErr) {
  console.error('profile read failed:', readErr.message)
  process.exit(1)
}
if (!before) {
  console.log('  no profile row exists — creating one')
  const { error: insErr } = await admin
    .from('profiles')
    .insert({ id: user.id, subscription_status: 'active', is_admin: true })
  if (insErr) {
    console.error('profile insert failed:', insErr.message)
    process.exit(1)
  }
} else {
  console.log(`  before: status=${before.subscription_status}, is_admin=${before.is_admin}`)
  const { error: updErr } = await admin
    .from('profiles')
    .update({ subscription_status: 'active' })
    .eq('id', user.id)
  if (updErr) {
    console.error('profile update failed:', updErr.message)
    process.exit(1)
  }
}

const { data: after } = await admin
  .from('profiles')
  .select('id, subscription_status, is_admin')
  .eq('id', user.id)
  .single()
console.log(`  after:  status=${after.subscription_status}, is_admin=${after.is_admin}`)
console.log(`\n✓ Done. Refresh your GovRFP browser tab — "Send to ProposalAI" button should now be enabled.`)
