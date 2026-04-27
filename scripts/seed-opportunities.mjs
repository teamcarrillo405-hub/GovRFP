#!/usr/bin/env node
/**
 * Seeds the opportunities table with representative federal construction
 * contracts. Run once after applying migration 00023 to populate the
 * Opportunities directory immediately without a SAM.gov API key.
 *
 * Usage:
 *   node scripts/seed-opportunities.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const now = new Date()
const daysOut = (n) => new Date(now.getTime() + n * 86400 * 1000).toISOString()
const daysBack = (n) => new Date(now.getTime() - n * 86400 * 1000).toISOString()

const SEED = [
  {
    notice_id: 'SEED-W912DQ-26-R-0012',
    solicitation_number: 'W912DQ-26-R-0012',
    title: 'Design-Build: Army Reserve Center Renovation — Fort Bragg, NC',
    agency: 'Department of Defense',
    office: 'Army Corps of Engineers',
    naics_code: '236220',
    set_aside: '8(a)',
    place_of_performance_state: 'NC',
    place_of_performance_city: 'Fort Bragg',
    estimated_value: 450000000,
    posted_date: daysBack(5),
    due_date: daysOut(21),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Design-build renovation of Army Reserve Center facilities including HVAC, electrical, and structural upgrades. Requires 8(a) certification.',
    match_score: null,
  },
  {
    notice_id: 'SEED-N40085-26-R-3301',
    solicitation_number: 'N40085-26-R-3301',
    title: 'NAVFAC: Small Business MATOC — Vertical Construction IDIQ',
    agency: 'Department of the Navy',
    office: 'NAVFAC Southwest',
    naics_code: '236220',
    set_aside: 'SB',
    place_of_performance_state: 'CA',
    place_of_performance_city: 'San Diego',
    estimated_value: 2500000000,
    posted_date: daysBack(3),
    due_date: daysOut(45),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Multiple Award Task Order Contract for vertical construction services at Naval facilities in the southwest region.',
    match_score: null,
  },
  {
    notice_id: 'SEED-VA26-26-R-0044',
    solicitation_number: 'VA26-26-R-0044',
    title: 'VA Medical Center — Parking Garage Replacement, Phoenix AZ',
    agency: 'Department of Veterans Affairs',
    office: 'VA-CFM',
    naics_code: '236220',
    set_aside: 'SB',
    place_of_performance_state: 'AZ',
    place_of_performance_city: 'Phoenix',
    estimated_value: 120000000,
    posted_date: daysBack(10),
    due_date: daysOut(14),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Demolition of existing parking structure and construction of a new 1,200-space multi-level parking facility at the Carl T. Hayden VA Medical Center.',
    match_score: null,
  },
  {
    notice_id: 'SEED-FA300526R0001',
    solicitation_number: 'FA300526R0001',
    title: 'Air Force Base Infrastructure — Utility Systems Repair IDIQ',
    agency: 'Department of the Air Force',
    office: 'AFCEC',
    naics_code: '237110',
    set_aside: 'SDVOSB',
    place_of_performance_state: 'TX',
    place_of_performance_city: 'San Antonio',
    estimated_value: 80000000,
    posted_date: daysBack(7),
    due_date: daysOut(30),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'IDIQ for utility systems repair and maintenance at Air Force installations. Work includes water, sewer, electrical, and natural gas distribution.',
    match_score: null,
  },
  {
    notice_id: 'SEED-GS-10P-26-BZ-C-0022',
    solicitation_number: 'GS-10P-26-BZ-C-0022',
    title: 'GSA Federal Building Renovation — Seattle Federal Courthouse',
    agency: 'General Services Administration',
    office: 'GSA PBS Region 10',
    naics_code: '236220',
    set_aside: 'HUBZone',
    place_of_performance_state: 'WA',
    place_of_performance_city: 'Seattle',
    estimated_value: 35000000,
    posted_date: daysBack(2),
    due_date: daysOut(28),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Interior and exterior renovation of the Seattle Federal Courthouse including lobby modernization, ADA upgrades, and security improvements.',
    match_score: null,
  },
  {
    notice_id: 'SEED-W9126G-26-R-0088',
    solicitation_number: 'W9126G-26-R-0088',
    title: 'USACE: Flood Control Channel Restoration — Los Angeles Basin',
    agency: 'Department of Defense',
    office: 'USACE Los Angeles District',
    naics_code: '237990',
    set_aside: 'SB',
    place_of_performance_state: 'CA',
    place_of_performance_city: 'Los Angeles',
    estimated_value: 95000000,
    posted_date: daysBack(15),
    due_date: daysOut(42),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Restoration of 12 miles of flood control channel including concrete lining repair, sediment removal, and bank stabilization.',
    match_score: null,
  },
  {
    notice_id: 'SEED-DACA875-26-R-0012',
    solicitation_number: 'DACA875-26-R-0012',
    title: 'National Park Service: Visitor Center Construction — Grand Canyon',
    agency: 'Department of the Interior',
    office: 'NPS Denver Service Center',
    naics_code: '236220',
    set_aside: 'WOSB',
    place_of_performance_state: 'AZ',
    place_of_performance_city: 'Grand Canyon Village',
    estimated_value: 28000000,
    posted_date: daysBack(4),
    due_date: daysOut(56),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'New visitor center construction featuring sustainable design, net-zero energy systems, and accessible facilities for the South Rim.',
    match_score: null,
  },
  {
    notice_id: 'SEED-HQ003426R0055',
    solicitation_number: 'HQ003426R0055',
    title: 'DLA: Warehouse Expansion — Defense Distribution Depot San Joaquin',
    agency: 'Defense Logistics Agency',
    office: 'DLA Distribution',
    naics_code: '236220',
    set_aside: 'SB',
    place_of_performance_state: 'CA',
    place_of_performance_city: 'Tracy',
    estimated_value: 65000000,
    posted_date: daysBack(8),
    due_date: daysOut(35),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Design-build expansion of existing warehouse facility adding 500,000 SF of temperature-controlled storage with automated conveyor systems.',
    match_score: null,
  },
  {
    notice_id: 'SEED-FA817226R0009',
    solicitation_number: 'FA817226R0009',
    title: 'Electrical Distribution Upgrade — Eglin AFB Main Substation',
    agency: 'Department of the Air Force',
    office: 'AFCEC',
    naics_code: '238210',
    set_aside: 'SB',
    place_of_performance_state: 'FL',
    place_of_performance_city: 'Eglin AFB',
    estimated_value: 18000000,
    posted_date: daysBack(6),
    due_date: daysOut(20),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Replacement of aging 138kV main substation equipment including transformers, switchgear, and control systems. Must maintain live operations.',
    match_score: null,
  },
  {
    notice_id: 'SEED-W81XWH26R0044',
    solicitation_number: 'W81XWH26R0044',
    title: 'VA: Seismic Retrofit — Long Beach VA Medical Center',
    agency: 'Department of Veterans Affairs',
    office: 'VA-CFM Pacific District',
    naics_code: '236220',
    set_aside: 'SB',
    place_of_performance_state: 'CA',
    place_of_performance_city: 'Long Beach',
    estimated_value: 145000000,
    posted_date: daysBack(1),
    due_date: daysOut(60),
    active: true,
    sam_url: 'https://sam.gov/opp/example',
    description: 'Full seismic retrofit of the 1970s-era hospital tower including base isolation system, structural steel reinforcement, and MEP system upgrades.',
    match_score: null,
  },
].map(opp => ({
  ...opp,
  synced_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}))

async function seed() {
  console.log(`Seeding ${SEED.length} construction opportunities...`)

  // Delete existing seed rows (notice_id starts with SEED-)
  await supabase
    .from('opportunities')
    .delete()
    .like('notice_id', 'SEED-%')

  const { error } = await supabase
    .from('opportunities')
    .insert(SEED)

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✓ Seeded ${SEED.length} opportunities`)

  const { count } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })

  console.log(`Total in DB: ${count}`)
}

seed()
