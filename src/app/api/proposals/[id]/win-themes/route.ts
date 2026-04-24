import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'viewer')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('proposals')
    .select('win_themes')
    .eq('id', proposalId)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to load win themes' }, { status: 500 })
  }

  const themes = (data?.win_themes as string[] | null) ?? []
  return NextResponse.json({ themes })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { themes?: unknown }
  const themes = Array.isArray(body.themes)
    ? (body.themes as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 5)
    : []

  const { error } = await supabase
    .from('proposals')
    .update({ win_themes: themes })
    .eq('id', proposalId)

  if (error) {
    return NextResponse.json({ error: 'Failed to save win themes' }, { status: 500 })
  }

  return NextResponse.json({ themes })
}
