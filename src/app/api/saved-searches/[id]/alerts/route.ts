import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { alerts_enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.alerts_enabled !== 'boolean') {
    return NextResponse.json({ error: 'alerts_enabled (boolean) is required' }, { status: 422 })
  }

  const { id } = await params
  const { data, error } = await supabase
    .from('saved_searches')
    .update({ alerts_enabled: body.alerts_enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) {
    console.error('[PATCH /api/saved-searches/[id]/alerts]', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
