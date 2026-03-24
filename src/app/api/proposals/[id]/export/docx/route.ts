import { Packer } from 'docx'
import { getUser, createClient } from '@/lib/supabase/server'
import { buildDocxDocument } from '@/lib/export/tiptap-to-docx'
import { stripComplianceMarks } from '@/lib/editor/compliance-gap-mark'
import type { JSONContent } from '@tiptap/react'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()

  // Load proposal title for filename
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { data: sections } = await supabase
    .from('proposal_sections')
    .select('section_name, content')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  if (!sections?.length) return new Response('No sections found', { status: 404 })

  // Strip compliance marks before conversion
  const cleanSections = sections.map((s: { section_name: string; content: JSONContent | null }) => ({
    section_name: s.section_name,
    content: s.content ? stripComplianceMarks(s.content) : null,
  }))

  const doc = buildDocxDocument(cleanSections)
  const buffer = await Packer.toBuffer(doc)

  // Sanitize title for filename
  const title = (proposal as { title?: string } | null)?.title ?? 'proposal'
  const safeFilename =
    title
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase() || 'proposal'

  return new Response(Buffer.from(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
    },
  })
}
