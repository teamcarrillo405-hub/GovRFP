import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const ADMIN_USER_ID = '6e71ebba-0cdb-4f48-8908-3251f101c2eb'

export default async function globalTeardown() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // Delete all E2E test proposals (cascade deletes rfp_analysis, document_jobs, proposal_sections)
  await supabase
    .from('proposals')
    .delete()
    .eq('user_id', ADMIN_USER_ID)
    .like('title', 'E2E Test — %')
}
