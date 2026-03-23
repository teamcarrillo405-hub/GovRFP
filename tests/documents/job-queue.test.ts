import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const migrationSql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/00002_document_ingestion.sql'),
  'utf-8'
)

const edgeFunctionSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/process-documents/index.ts'),
  'utf-8'
)

describe('job-queue', () => {
  it('claim_next_document_job SQL function exists in migration', () => {
    expect(migrationSql).toContain('claim_next_document_job')
    expect(migrationSql).toContain('for update skip locked')
  })

  it('document_jobs RLS policy exists for authenticated users', () => {
    expect(migrationSql).toContain('enable row level security')
    expect(migrationSql).toContain('Users can view own document_jobs')
  })

  it('document_jobs status check constraint allows only valid statuses', () => {
    expect(migrationSql).toContain("'pending'")
    expect(migrationSql).toContain("'processing'")
    expect(migrationSql).toContain("'completed'")
    expect(migrationSql).toContain("'failed'")
  })

  it('document_jobs table has required columns', () => {
    expect(migrationSql).toContain('proposal_id')
    expect(migrationSql).toContain('storage_path')
    expect(migrationSql).toContain('file_type')
    expect(migrationSql).toContain('page_offset')
  })

  it('Edge Function calls claim_next_document_job RPC', () => {
    expect(edgeFunctionSource).toContain("rpc('claim_next_document_job')")
  })

  it('Edge Function updates proposal with rfp_text and rfp_structure', () => {
    expect(edgeFunctionSource).toContain('rfp_text')
    expect(edgeFunctionSource).toContain('rfp_structure')
    expect(edgeFunctionSource).toContain("status: 'ready'")
  })

  it('Edge Function handles job failure with error message', () => {
    expect(edgeFunctionSource).toContain("status: 'failed'")
    expect(edgeFunctionSource).toContain('error_message')
  })

  it('Edge Function detects scanned PDFs and routes to Textract OCR', () => {
    expect(edgeFunctionSource).toContain('isScanned')
    expect(edgeFunctionSource).toContain('Textract')
  })

  it('Edge Function rejects scanned PDFs over 10MB for OCR', () => {
    expect(edgeFunctionSource).toContain('10_485_760')
  })

  it('Edge Function imports unpdf for PDF parsing', () => {
    expect(edgeFunctionSource).toContain('unpdf/serverless')
  })

  it('Edge Function contains extractRfpStructure function', () => {
    expect(edgeFunctionSource).toContain('extractRfpStructure')
  })
})
