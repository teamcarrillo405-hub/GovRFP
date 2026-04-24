// Local script to process a pending document job — bypasses Edge Function
import { createClient } from '@supabase/supabase-js'
import { extractText } from 'unpdf'

const SUPABASE_URL = 'https://qxiziskdrbhtoyorwfxy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

function extractRfpStructure(text) {
  const sections = []
  const requirements = []
  const sectionRegex = /^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:]\s*(.+)|(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,}))/gm
  let match
  while ((match = sectionRegex.exec(text)) !== null) {
    const number = (match[1] || match[3] || '').trim()
    const title = (match[2] || match[4] || '').trim()
    if (number && title && title.length < 200) sections.push({ number, title })
  }
  const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)\s*/)
  const kwRegex = /\b(shall|must|will|should)\b/i
  let currentSection
  for (const sentence of sentences) {
    const secMatch = sentence.match(/^(?:(?:SECTION\s+)?([A-Z](?:\.\d+)*)\s*[-.:])|(^\d+(?:\.\d+)*)\s/)
    if (secMatch) currentSection = (secMatch[1] || secMatch[2] || '').trim()
    const kwMatch = sentence.match(kwRegex)
    if (kwMatch && sentence.length > 20 && sentence.length < 1000) {
      requirements.push({ text: sentence.trim(), type: kwMatch[1].toLowerCase(), sectionRef: currentSection })
    }
  }
  return { sections, requirements }
}

async function run() {
  // Claim next pending job
  const { data: jobs, error } = await supabase.rpc('claim_next_document_job')
  if (error) { console.error('Claim error:', error); process.exit(1) }
  const job = jobs?.[0]
  if (!job) { console.log('No pending jobs.'); process.exit(0) }

  console.log(`Processing job ${job.id} — ${job.storage_path}`)

  // Download file
  const { data: fileData, error: dlError } = await supabase.storage
    .from('rfp-documents')
    .download(job.storage_path)
  if (dlError || !fileData) { console.error('Download error:', dlError); process.exit(1) }

  const arrayBuffer = await fileData.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  // Parse PDF
  let text = ''
  let pageCount = 0
  try {
    const result = await extractText(uint8, { mergePages: true })
    text = typeof result === 'string' ? result : (result?.text ?? '')
    pageCount = result?.totalPages ?? 1
  } catch (e) {
    console.error('PDF parse error:', e)
    process.exit(1)
  }

  console.log(`Extracted ${text.length} chars, ${pageCount} pages`)

  const rfpStructure = extractRfpStructure(text)
  console.log(`Found ${rfpStructure.sections.length} sections, ${rfpStructure.requirements.length} requirements`)

  // Update proposal
  const { error: updateError } = await supabase.from('proposals').update({
    rfp_text: text,
    rfp_structure: rfpStructure,
    page_count: pageCount,
    is_scanned: false,
    ocr_used: false,
    status: 'ready',
    updated_at: new Date().toISOString(),
  }).eq('id', job.proposal_id)

  if (updateError) { console.error('Update error:', updateError); process.exit(1) }

  // Mark job complete
  await supabase.from('document_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id)

  // Enqueue analysis job
  await supabase.from('document_jobs').insert({
    proposal_id: job.proposal_id,
    user_id: job.user_id,
    storage_path: job.storage_path,
    file_type: job.file_type,
    job_type: 'analysis',
    status: 'pending',
  })

  console.log('Done! Proposal is ready, analysis job queued.')
}

run().catch(console.error)
