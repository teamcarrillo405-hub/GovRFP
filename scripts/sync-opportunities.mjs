#!/usr/bin/env node
/**
 * Standalone sync: fetches live federal construction opportunities from SAM.gov
 * and inserts them into the opportunities table.
 *
 * Usage: node scripts/sync-opportunities.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const API_KEY = process.env.SAM_GOV_API_KEY
const BASE_URL = 'https://api.sam.gov/opportunities/v2/search'

const CONSTRUCTION_NAICS = [
  '236220', '236210',
  '237110', '237310', '237990',
  '238110', '238120', '238160', '238190',
  '238210', '238220', '238290',
  '238310', '238320', '238910', '238990',
]

const SET_ASIDE_MAP = {
  'Total Small Business Set-Aside': 'SB',
  'Small Business': 'SB',
  '8(a) Set-Aside': '8(a)',
  'HUBZone Set-Aside': 'HUBZone',
  'Service-Disabled Veteran-Owned Small Business': 'SDVOSB',
  'Women-Owned Small Business': 'WOSB',
  'Economically Disadvantaged Women-Owned Small Business': 'EDWOSB',
  'Unrestricted': 'Unrestricted',
}

function mmddyyyy(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}/${d}/${date.getFullYear()}`
}

function toTimestamp(val) {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function normalize(raw) {
  const agencyParts = raw.fullParentPathName?.split('.')
  const agency = agencyParts?.[0]?.trim() ?? raw.organizationName ?? null
  const rawSetAside = raw.typeOfSetAsideDescription ?? ''
  return {
    notice_id: raw.noticeId,
    solicitation_number: raw.solicitationNumber ?? null,
    title: raw.title,
    agency,
    office: agencyParts?.[1]?.trim() ?? null,
    naics_code: raw.naicsCode ?? null,
    set_aside: SET_ASIDE_MAP[rawSetAside] ?? (rawSetAside || null),
    place_of_performance_state: raw.placeOfPerformance?.state?.code ?? null,
    place_of_performance_city: raw.placeOfPerformance?.city?.name ?? null,
    estimated_value: null,
    posted_date: toTimestamp(raw.postedDate),
    due_date: toTimestamp(raw.responseDeadLine),
    active: true,
    sam_url: raw.uiLink ?? raw.link ?? null,
    description: null,
    match_score: null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function fetchPage(naics, offset, daysBack = 90) {
  const now = new Date()
  const from = new Date(now.getTime() - daysBack * 86400 * 1000)
  const params = new URLSearchParams({
    api_key: API_KEY,
    ptype: 'o,p,k',
    ncode: naics,
    limit: '100',
    offset: String(offset),
    postedFrom: mmddyyyy(from),
    postedTo: mmddyyyy(now),
    active: 'Yes',
  })
  const res = await fetch(`${BASE_URL}?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`SAM.gov ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sync() {
  if (!API_KEY) { console.error('SAM_GOV_API_KEY not set'); process.exit(1) }

  console.log('Fetching construction opportunities from SAM.gov...')
  const all = []
  const seenIds = new Set()

  let rateLimited = false
  for (const naics of CONSTRUCTION_NAICS) {
    if (rateLimited) break
    let offset = 0
    for (let page = 0; page < 3; page++) {
      try {
        const resp = await fetchPage(naics, offset)
        const batch = resp.opportunitiesData ?? []
        let newCount = 0
        for (const opp of batch) {
          if (!seenIds.has(opp.noticeId)) {
            seenIds.add(opp.noticeId)
            all.push(opp)
            newCount++
          }
        }
        if (batch.length > 0) console.log(`  ${naics} page ${page + 1}: ${batch.length} records (+${newCount} new, total SAM: ${resp.totalRecords})`)
        if (batch.length < 100) break
        offset += 100
      } catch (err) {
        if (err.message?.includes('429') || err.message?.includes('throttled')) {
          console.warn(`  Rate limit hit — saving ${all.length} records collected so far`)
          rateLimited = true
        } else {
          console.error(`  ${naics} error:`, err.message)
        }
        break
      }
    }
  }

  console.log(`\nFetched ${all.length} unique opportunities`)
  if (all.length === 0) { console.log('Nothing to sync.'); return }

  const normalized = all.map(normalize)

  // Delete existing live-sync rows (not our seed rows)
  await supabase
    .from('opportunities')
    .delete()
    .not('notice_id', 'like', 'SEED-%')
    .not('notice_id', 'is', null)

  // Insert in chunks of 50
  let inserted = 0
  for (let i = 0; i < normalized.length; i += 50) {
    const chunk = normalized.slice(i, i + 50)
    const { error } = await supabase.from('opportunities').insert(chunk)
    if (error) { console.error(`Chunk ${i} error:`, error.message); continue }
    inserted += chunk.length
  }

  console.log(`✓ Synced ${inserted}/${all.length} opportunities`)

  const { count } = await supabase.from('opportunities').select('*', { count: 'exact', head: true })
  console.log(`Total in DB: ${count}`)
}

sync().catch(e => { console.error(e); process.exit(1) })
