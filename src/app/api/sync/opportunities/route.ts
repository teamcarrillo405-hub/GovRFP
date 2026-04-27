import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllConstructionOpportunities } from '@/lib/sam-gov/fetch'
import { normalize } from '@/lib/sam-gov/normalize'

// Requires SAM_GOV_API_KEY in env. Falls back to seed data if not set.
// Secured by SYNC_SECRET to prevent unauthorized triggers.
export async function POST(request: Request) {
  const secret = request.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.SAM_GOV_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'SAM_GOV_API_KEY not configured' }, { status: 503 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const raw = await fetchAllConstructionOpportunities(apiKey)
    const normalized = raw.map(normalize)

    if (normalized.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No opportunities returned' })
    }

    // Upsert on notice_id (unique SAM.gov identifier)
    const { error } = await supabase
      .from('opportunities')
      .upsert(
        normalized.map(opp => ({ ...opp, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
        { onConflict: 'notice_id', ignoreDuplicates: false },
      )

    if (error) {
      console.error('[sync/opportunities] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mark old opportunities as inactive (not seen in last 7 days)
    await supabase
      .from('opportunities')
      .update({ active: false })
      .lt('synced_at', new Date(Date.now() - 7 * 86400 * 1000).toISOString())

    return NextResponse.json({ synced: normalized.length })
  } catch (err) {
    console.error('[sync/opportunities] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
