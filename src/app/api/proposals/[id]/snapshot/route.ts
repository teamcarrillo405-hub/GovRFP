import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let label: string | undefined
  try {
    const body = await request.json()
    label = body?.label ?? undefined
  } catch {
    // label is optional — body may be empty
  }

  // Read all current sections for this proposal
  const { data: sections, error: sectionsError } = await supabase
    .from('proposal_sections')
    .select('section_name, content')
    .eq('proposal_id', proposalId)

  if (sectionsError) {
    return NextResponse.json({ error: 'Failed to read sections' }, { status: 500 })
  }

  if (!sections || sections.length === 0) {
    return NextResponse.json({ error: 'No sections to snapshot' }, { status: 400 })
  }

  const snapshotAt = new Date().toISOString()

  // Write one row per section into section_versions
  const rows = sections.map((s) => ({
    proposal_id: proposalId,
    section_name: s.section_name,
    content: s.content,
    snapshot_at: snapshotAt,
    label: label ?? null,
    created_by: user.id,
  }))

  try {
    const { data: inserted, error: insertError } = await (supabase as any)
      .from('section_versions')
      .insert(rows)
      .select('id')

    if (insertError) {
      console.error('[snapshot] insert error', insertError)
      return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 })
    }

    // Return the id of the first inserted row as the snapshot group identifier
    const snapshotId = (inserted as { id: string }[])?.[0]?.id ?? null

    return NextResponse.json({
      snapshot_id: snapshotId,
      section_count: rows.length,
      snapshot_at: snapshotAt,
    })
  } catch (err) {
    console.error('[snapshot] unexpected error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
