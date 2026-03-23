import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routeSource = readFileSync(
  resolve(__dirname, '../../src/app/api/documents/upload-url/route.ts'),
  'utf-8'
)

describe('upload-url API', () => {
  it('exports a POST handler', () => {
    expect(routeSource).toContain('export async function POST')
  })

  it('validates file type to pdf or docx only', () => {
    expect(routeSource).toContain("z.enum(['pdf', 'docx'])")
  })

  it('enforces 50MB file size limit', () => {
    expect(routeSource).toContain('50 * 1024 * 1024')
  })

  it('checks subscription before creating proposal', () => {
    // Subscription check must appear before proposal insert
    const subCheckIndex = routeSource.indexOf('isSubscriptionActive')
    const insertIndex = routeSource.indexOf("from('proposals')")
    expect(subCheckIndex).toBeGreaterThan(-1)
    expect(insertIndex).toBeGreaterThan(-1)
    expect(subCheckIndex).toBeLessThan(insertIndex)
  })

  it('uses admin client for storage operations', () => {
    expect(routeSource).toContain('createAdminClient')
    expect(routeSource).toContain('createSignedUploadUrl')
  })

  it('creates document_jobs row with pending status', () => {
    expect(routeSource).toContain("from('document_jobs')")
    expect(routeSource).toContain("status: 'pending'")
  })

  it('uses Zod v4 error format (issues not errors)', () => {
    expect(routeSource).toContain('parsed.error.issues')
    expect(routeSource).not.toContain('parsed.error.errors')
  })

  it('returns 401 for unauthenticated requests (structural check)', () => {
    expect(routeSource).toContain("status: 401")
    expect(routeSource).toContain("'Unauthorized'")
  })

  it('returns 402 for inactive subscription (structural check)', () => {
    expect(routeSource).toContain("status: 402")
  })
})
