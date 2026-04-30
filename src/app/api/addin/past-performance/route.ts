import { createClient } from '@supabase/supabase-js'
import { extractBearer } from '@/lib/addin/auth-helper'

export async function GET(request: Request) {
  const token = extractBearer(request)
  if (!token) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('past_performance')
    .select('id, contract_title, customer_name, scope_narrative, contract_value_usd, naics_codes, period_start, period_end')
    .order('created_at', { ascending: false })
    .limit(10)

  if (q) {
    query = query.or(`contract_title.ilike.%${q}%,scope_narrative.ilike.%${q}%,customer_name.ilike.%${q}%`)
  }

  const { data, error: dbError } = await query
  if (dbError) return new Response(dbError.message, { status: 500 })
  return Response.json({ records: data ?? [] })
}
