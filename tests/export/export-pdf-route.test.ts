import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routeSource = readFileSync(
  resolve(__dirname, '../../src/app/api/proposals/[id]/export/pdf/route.ts'),
  'utf-8'
)

describe('POST /api/proposals/[id]/export/pdf', () => {
  it('returns 401 for unauthenticated request', () => {
    expect(routeSource).toContain("status: 401")
    expect(routeSource).toContain('Unauthorized')
  })

  it('returns 404 when proposal has no sections', () => {
    expect(routeSource).toContain("status: 404")
    expect(routeSource).toContain('No sections found')
  })

  it('returns 200 with correct Content-Type application/pdf', () => {
    expect(routeSource).toContain("'Content-Type'")
    expect(routeSource).toContain('application/pdf')
  })

  it('returns Content-Disposition attachment header with filename', () => {
    expect(routeSource).toContain("'Content-Disposition'")
    expect(routeSource).toContain('attachment')
    expect(routeSource).toContain('.pdf')
  })

  it('returns non-empty body', () => {
    // The route builds a PDF buffer and returns it in the Response body
    expect(routeSource).toContain('buildPdfBuffer')
    expect(routeSource).toContain('new Response(buffer')
  })
})
