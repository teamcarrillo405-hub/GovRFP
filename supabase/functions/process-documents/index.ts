// Supabase Edge Function — runs on Deno runtime
// Triggered by pg_cron (every 60s) or HTTP invoke
// Claims and processes one pending document job per invocation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentJob {
  id: string
  proposal_id: string
  user_id: string
  storage_path: string
  file_type: 'pdf' | 'docx'
  status: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const awsAccessKey = Deno.env.get('AWS_ACCESS_KEY_ID')
  const awsSecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
  const awsRegion = Deno.env.get('AWS_REGION') ?? 'us-east-1'

  // Service-role client — operates on behalf of the system, bypasses RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    // 1. Claim next pending job (atomic — FOR UPDATE SKIP LOCKED prevents double-processing)
    const { data: jobs, error: claimError } = await supabase
      .rpc('claim_next_document_job')

    if (claimError) {
      console.error('Failed to claim job:', claimError)
      return new Response(JSON.stringify({ error: 'Failed to claim job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // RPC returns an array; claim function returns at most 1 row
    const job: DocumentJob | undefined = jobs?.[0]

    if (!job) {
      // No pending jobs — normal idle response
      return new Response(JSON.stringify({ message: 'no jobs pending' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing job ${job.id} for proposal ${job.proposal_id}`)

    // 2. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rfp-documents')
      .download(job.storage_path)

    if (downloadError || !fileData) {
      await failJob(supabase, job, `Failed to download file: ${downloadError?.message}`)
      return new Response(JSON.stringify({ error: 'Download failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    // 3. Parse text based on file type
    let text = ''
    let pageCount = 0
    let isScanned = false
    let ocrUsed = false

    if (job.file_type === 'pdf') {
      // PDF parsing using unpdf via npm specifier (Deno supports npm: imports)
      const { extractText } = await import('npm:unpdf/serverless')
      let pages: string[] = []

      try {
        // Attempt per-page extraction for scanned detection
        const pagesResult = await extractText(uint8, { mergePages: false })
        pages = Array.isArray(pagesResult) ? pagesResult : [pagesResult?.text ?? '']
      } catch {
        // Fallback: merge all pages
        const merged = await extractText(uint8)
        pages = [typeof merged === 'string' ? merged : (merged?.text ?? '')]
      }

      pageCount = pages.length
      text = pages.join('\n\n')

      // Scanned PDF detection: average chars per page below threshold
      const SCANNED_THRESHOLD = 100
      const charPerPage = pages.map((p: string) => p.trim().length)
      const anyBelow = charPerPage.some((c: number) => c < SCANNED_THRESHOLD)
      const avg = charPerPage.length > 0
        ? charPerPage.reduce((s: number, c: number) => s + c, 0) / charPerPage.length
        : 0
      isScanned = anyBelow || avg < SCANNED_THRESHOLD

      if (isScanned) {
        console.log(`Job ${job.id}: Detected scanned PDF (avg ${Math.round(avg)} chars/page), routing to Textract OCR`)

        // Textract sync API accepts max 10MB
        const MAX_TEXTRACT_BYTES = 10 * 1024 * 1024 // 10_485_760
        if (uint8.byteLength > 10_485_760) {
          await failJob(supabase, job,
            `Scanned PDF too large for OCR (${Math.round(uint8.byteLength / 1024 / 1024)}MB). ` +
            'Please upload a smaller scanned document (under 10MB) or a text-based PDF.')
          return new Response(JSON.stringify({ error: 'File too large for OCR' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!awsAccessKey || !awsSecretKey) {
          await failJob(supabase, job, 'OCR not configured: AWS credentials missing.')
          return new Response(JSON.stringify({ error: 'OCR not configured' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Call AWS Textract DetectDocumentText (sync API — raw fetch, no SDK needed)
        text = await callTextract(uint8, awsAccessKey, awsSecretKey, awsRegion)
        ocrUsed = true
      }
    } else if (job.file_type === 'docx') {
      // DOCX parsing using mammoth via npm specifier
      const mammoth = await import('npm:mammoth')
      // Buffer is available globally in newer Deno versions; use Uint8Array if not
      const nodeBuffer = Buffer.from(arrayBuffer)
      const result = await mammoth.default.extractRawText({ buffer: nodeBuffer })
      text = result.value
      pageCount = 1 // DOCX extraction doesn't track pages
    }

    // 4. Extract RFP structure using regex heuristics (inline — Deno cannot import from src/)
    const rfpStructure = extractRfpStructure(text)

    // 5. Update proposals table with parsed results
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        rfp_text: text,
        rfp_structure: rfpStructure,
        page_count: pageCount,
        is_scanned: isScanned,
        ocr_used: ocrUsed,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.proposal_id)

    if (updateError) {
      await failJob(supabase, job, `Failed to update proposal: ${updateError.message}`)
      return new Response(JSON.stringify({ error: 'Update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Mark job as completed
    await supabase
      .from('document_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    console.log(`Job ${job.id} completed successfully`)

    // 7. Enqueue analysis job (Phase 3) — runs in separate Edge Function
    // Check subscription before queuing to avoid wasted analysis on lapsed users
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at')
      .eq('id', job.user_id)
      .single()

    const subActive =
      userProfile?.subscription_status === 'active' ||
      (userProfile?.subscription_status === 'trialing' &&
       new Date(userProfile.trial_ends_at ?? 0) > new Date())

    if (subActive) {
      await supabase.from('document_jobs').insert({
        proposal_id: job.proposal_id,
        user_id: job.user_id,
        storage_path: job.storage_path,
        file_type: job.file_type,
        job_type: 'analysis',
        status: 'pending',
      })
      console.log(`Enqueued analysis job for proposal ${job.proposal_id}`)
    } else {
      console.log(`Skipped analysis enqueue for proposal ${job.proposal_id} — subscription inactive`)
    }

    return new Response(JSON.stringify({ success: true, proposalId: job.proposal_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unexpected error in process-documents:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// =============================================================================
// Helper: Mark job as failed and reset proposal to draft for retry
// =============================================================================
async function failJob(
  supabase: ReturnType<typeof createClient>,
  job: DocumentJob,
  errorMessage: string
): Promise<void> {
  console.error(`Job ${job.id} failed: ${errorMessage}`)

  await supabase
    .from('document_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  // Reset proposal to draft so user can retry upload
  await supabase
    .from('proposals')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.proposal_id)
}

// =============================================================================
// Helper: AWS Textract DetectDocumentText via raw fetch + SigV4
// Avoids importing the full @aws-sdk (Node.js-centric) in Deno Edge Function
// =============================================================================
async function callTextract(
  fileBytes: Uint8Array,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<string> {
  const encoder = new TextEncoder()
  const endpoint = `https://textract.${region}.amazonaws.com/`

  // Textract expects Document.Bytes as base64 string in JSON body
  // Safe for files <= 10MB (enforced before calling this function)
  const base64 = btoa(String.fromCharCode(...fileBytes))
  const body = JSON.stringify({ Document: { Bytes: base64 } })

  // Timestamp for SigV4
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const shortDate = dateStamp.slice(0, 8)

  async function sha256Hex(message: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(message))
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  }

  // Build canonical request
  const payloadHash = await sha256Hex(body)
  const host = `textract.${region}.amazonaws.com`
  const canonicalHeaders =
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${dateStamp}\n` +
    `x-amz-target:Textract.DetectDocumentText\n`
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target'

  const canonicalRequest = [
    'POST', '/', '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n')

  // String to sign
  const credentialScope = `${shortDate}/${region}/textract/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256', dateStamp, credentialScope, await sha256Hex(canonicalRequest),
  ].join('\n')

  // Derive signing key: HMAC chain
  let signingKey: ArrayBuffer = encoder.encode(`AWS4${secretKey}`).buffer as ArrayBuffer
  for (const part of [shortDate, region, 'textract', 'aws4_request']) {
    signingKey = await hmacSha256(signingKey, part)
  }
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Date': dateStamp,
      'X-Amz-Target': 'Textract.DetectDocumentText',
      Authorization: authorization,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Textract API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()
  // Extract LINE blocks — the readable text lines
  const lines = (result.Blocks ?? [])
    .filter((block: { BlockType: string }) => block.BlockType === 'LINE')
    .map((block: { Text?: string }) => block.Text ?? '')

  return lines.join('\n')
}

// =============================================================================
// Inline: RFP structure extraction
// Duplicated from src/lib/documents/rfp-structure.ts — Deno cannot import from src/
// Keep these in sync if the heuristic changes.
// =============================================================================
interface RfpSection {
  number: string
  title: string
}

interface RfpRequirement {
  text: string
  type: 'shall' | 'must' | 'will' | 'should'
  sectionRef?: string
}

interface RfpStructure {
  sections: RfpSection[]
  requirements: RfpRequirement[]
}

function extractRfpStructure(text: string): RfpStructure {
  const sections: RfpSection[] = []
  const requirements: RfpRequirement[] = []

  // Section heading patterns: "SECTION A — Title", "1.2 TITLE", "A. Title"
  const sectionRegex =
    /^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:]\s*(.+)|(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,}))/gm
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(text)) !== null) {
    const number = (match[1] || match[3] || '').trim()
    const title = (match[2] || match[4] || '').trim()
    if (number && title && title.length < 200) {
      sections.push({ number, title })
    }
  }

  // Requirement sentences: contains shall/must/will/should
  const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)\s*/)
  const kwRegex = /\b(shall|must|will|should)\b/i
  let currentSection: string | undefined

  for (const sentence of sentences) {
    // Update current section context
    const secMatch = sentence.match(
      /^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:])|(^\d+(?:\.\d+)*)\s/
    )
    if (secMatch) {
      currentSection = (secMatch[1] || secMatch[2] || '').trim()
    }

    const kwMatch = sentence.match(kwRegex)
    if (kwMatch && sentence.length > 20 && sentence.length < 1000) {
      requirements.push({
        text: sentence.trim(),
        type: kwMatch[1].toLowerCase() as RfpRequirement['type'],
        sectionRef: currentSection,
      })
    }
  }

  return { sections, requirements }
}
