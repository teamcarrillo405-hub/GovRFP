import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposal_sections')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('user_id', user.id)
    .order('section_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load sections' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { section_name, content, draft_status } = body

  const { data, error } = await supabase
    .from('proposal_sections')
    .upsert({
      proposal_id: proposalId,
      user_id: user.id,
      section_name,
      content,
      draft_status,
      last_saved_at: new Date().toISOString(),
    }, { onConflict: 'proposal_id,section_name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save section' }, { status: 500 })
  }

  return NextResponse.json(data)
}
