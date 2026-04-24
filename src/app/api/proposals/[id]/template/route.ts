import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import type { CustomTemplateSection } from '@/lib/editor/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/** Extract raw text from an uploaded file (PDF or DOCX). Falls back to plain text. */
async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    // Use unpdf — available in package.json
    try {
      const { getDocumentProxy, extractText: unpdfExtractText } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await unpdfExtractText(pdf, { mergePages: true })
      return text
    } catch {
      // unpdf failed — return empty so Claude gets a minimal prompt
      return ''
    }
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch {
      return ''
    }
  }

  // Plain text fallback
  return buffer.toString('utf-8')
}

/** Validate that a value is a well-formed CustomTemplateSection array. */
function validateSections(raw: unknown): CustomTemplateSection[] {
  if (!Array.isArray(raw)) throw new Error('Claude returned non-array JSON')
  return raw.map((item: unknown, idx: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item ${idx} is not an object`)
    }
    const obj = item as Record<string, unknown>
    if (typeof obj.id !== 'string' || !obj.id) throw new Error(`Item ${idx} missing id`)
    if (typeof obj.title !== 'string' || !obj.title) throw new Error(`Item ${idx} missing title`)
    return {
      id: obj.id,
      title: obj.title,
      pageHint: typeof obj.pageHint === 'string' ? obj.pageHint : undefined,
      required: obj.required === true,
    } satisfies CustomTemplateSection
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must be editor or above on this proposal
  const roleResult = await requireProposalRole(proposalId, 'editor')
  if (!roleResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse multipart form
  let file: File | null = null
  try {
    const formData = await request.formData()
    file = formData.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided in "file" field' }, { status: 400 })
  }

  // Extract text
  const docText = await extractText(file)
  const truncated = docText.slice(0, 40_000) // stay within token limits for haiku

  // Call Claude haiku to extract section headings
  const claudeResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a federal proposal analyst. Extract all section headings from the solicitation template text below.

Return ONLY a JSON array with no markdown fences, no explanation — just the raw JSON array.

Each element must have:
- "id": a URL-safe slug of the title (lowercase, hyphens, e.g. "c1-scope-of-work")
- "title": the exact section heading text (e.g. "C.1 Scope of Work")
- "required": true if the section says "offeror shall provide", "offeror must", or similar mandatory language; false otherwise
- "pageHint": the page reference if visible near the heading (e.g. "Page 12"), or omit the field if not found

Example output:
[{"id":"c1-scope-of-work","title":"C.1 Scope of Work","required":true,"pageHint":"Page 12"},{"id":"l1-instructions","title":"L.1 Instructions to Offerors","required":true}]

Template text:
${truncated || '[No text could be extracted from this file]'}`,
      },
    ],
  })

  const rawContent = claudeResponse.content[0]
  if (rawContent.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected Claude response format' }, { status: 502 })
  }

  // Parse and validate the JSON
  let sections: CustomTemplateSection[]
  try {
    const jsonText = rawContent.text.trim()
    const parsed = JSON.parse(jsonText)
    sections = validateSections(parsed)
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse Claude response: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 }
    )
  }

  // Persist to proposals.custom_template_sections (JSONB column)
  // If the column doesn't exist yet the update will fail — we still return the data.
  const { error: dbError } = await supabase
    .from('proposals')
    .update({ custom_template_sections: sections })
    .eq('id', proposalId)

  if (dbError) {
    // Non-fatal: column may not exist in this environment yet
    console.warn('[template/route] Could not persist custom_template_sections:', dbError.message)
  }

  return NextResponse.json({ sections })
}
