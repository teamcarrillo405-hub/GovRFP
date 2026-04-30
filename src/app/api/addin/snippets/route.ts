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
  const category = searchParams.get('category')?.trim()
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('content_snippets')
    .select('id, title, body, category, tags')
    .order('use_count', { ascending: false })
    .limit(20)

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  if (q) {
    query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`)
  }

  const { data, error: dbError } = await query
  if (dbError) return new Response(dbError.message, { status: 500 })
  return Response.json({ snippets: data ?? [] })
}
