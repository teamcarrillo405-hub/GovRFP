import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import { z } from 'zod'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(['pdf', 'docx']),
  fileSize: z.number().positive().max(MAX_FILE_SIZE, 'File size exceeds 50MB limit'),
  mimeType: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  proposalId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  // 1. Auth check
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Subscription gate — all new proposal creation gated
  const subscription = await checkSubscription(user.id)
  if (!isSubscriptionActive(subscription.status)) {
    return NextResponse.json(
      { error: 'Active subscription required to upload documents' },
      { status: 402 }
    )
  }

  // 3. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = uploadSchema.safeParse(body)
  if (!parsed.success) {
    // Zod v4: use .issues not .errors
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { fileName, fileType, fileSize, mimeType, title, proposalId: existingProposalId } = parsed.data

  // Validate MIME type if provided (extra safety — file extension is primary check)
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: 'Only PDF and DOCX files are supported' },
      { status: 400 }
    )
  }

  // Explicit size check (belt + suspenders alongside Zod schema)
  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File must be 50MB or smaller' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  let proposal: { id: string }

  if (existingProposalId) {
    // 4a. Update existing draft proposal (e.g., from GovRFP handoff with no file yet)
    const { data: existing, error: fetchError } = await admin
      .from('proposals')
      .select('id, status, user_id')
      .eq('id', existingProposalId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Proposal not found or not eligible for upload' },
        { status: 404 }
      )
    }

    const { error: updateError } = await admin
      .from('proposals')
      .update({ status: 'processing', file_name: fileName, file_type: fileType })
      .eq('id', existingProposalId)

    if (updateError) {
      console.error('Failed to update proposal:', updateError)
      return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
    }

    proposal = { id: existingProposalId }
  } else {
    // 4b. Create new proposal row
    const { data: newProposal, error: proposalError } = await admin
      .from('proposals')
      .insert({
        user_id: user.id,
        title: title || fileName.replace(/\.(pdf|docx)$/i, ''),
        status: 'processing',
        file_name: fileName,
        file_type: fileType,
      })
      .select('id')
      .single()

    if (proposalError || !newProposal) {
      console.error('Failed to create proposal:', proposalError)
      return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
    }

    proposal = newProposal
  }

  // 5. Build storage path: {userId}/{proposalId}/original.{ext}
  const ext = fileType === 'pdf' ? 'pdf' : 'docx'
  const storagePath = `${user.id}/${proposal.id}/original.${ext}`

  // 6. Create signed upload URL for direct browser upload
  //    (bypasses Vercel 4.5MB body limit — browser uploads directly to Supabase Storage)
  const { data: upload, error: uploadError } = await admin.storage
    .from('rfp-documents')
    .createSignedUploadUrl(storagePath)

  if (uploadError || !upload) {
    console.error('Failed to create signed URL:', uploadError)
    // Clean up the proposal row to avoid orphans
    await admin.from('proposals').delete().eq('id', proposal.id)
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }

  // 7. Update proposal with storage path
  await admin
    .from('proposals')
    .update({ storage_path: storagePath })
    .eq('id', proposal.id)

  // 8. Insert document_jobs row (status: pending — Edge Function picks it up via pg_cron)
  const { error: jobError } = await admin
    .from('document_jobs')
    .insert({
      proposal_id: proposal.id,
      user_id: user.id,
      storage_path: storagePath,
      file_type: fileType,
      status: 'pending',
    })

  if (jobError) {
    console.error('Failed to create document job:', jobError)
    // Clean up to avoid orphaned proposal without a processing job
    await admin.from('proposals').delete().eq('id', proposal.id)
    return NextResponse.json({ error: 'Failed to queue document for processing' }, { status: 500 })
  }

  // 9. Return signed URL + identifiers to client
  return NextResponse.json({
    signedUrl: upload.signedUrl,
    token: upload.token,
    path: upload.path,
    proposalId: proposal.id,
  })
}
