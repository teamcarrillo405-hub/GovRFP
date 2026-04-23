import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { buildPdfBuffer } from '@/lib/export/tiptap-to-pdf'
import { stripComplianceMarks } from '@/lib/editor/compliance-gap-mark'

export const runtime = 'nodejs'  // CRITICAL — prevents edge runtime + react-reconciler conflict

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // requireProposalRole covers solo owner and all team members at viewer+
  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) return new Response('Forbidden', { status: 403 })

  const supabase = await createClient()

  // Load proposal title for filename
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title')
    .eq('id', id)
    .single()

  const { data: sections } = await supabase
    .from('proposal_sections')
    .select('section_name, content')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  if (!sections?.length) return new Response('No sections found', { status: 404 })

  // Strip compliance marks before conversion
  const cleanSections = sections.map(s => ({
    section_name: s.section_name,
    content: s.content ? stripComplianceMarks(s.content) : null,
  }))

  let buffer: Buffer
  try {
    buffer = await buildPdfBuffer(cleanSections)
  } catch (err) {
    console.error('[pdf-export] buildPdfBuffer failed:', err)
    return Response.json(
      { error: 'Failed to generate PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  // Sanitize title for filename
  const title = proposal?.title ?? 'proposal'
  const safeFilename = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase() || 'proposal'

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`,
    },
  })
}
