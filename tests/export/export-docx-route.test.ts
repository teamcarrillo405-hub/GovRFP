import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JSONContent } from '@tiptap/react'

// Mock Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}))

// Mock buildDocxDocument + Packer
vi.mock('@/lib/export/tiptap-to-docx', () => ({
  buildDocxDocument: vi.fn(() => ({ __mockDoc: true })),
}))

vi.mock('docx', async () => {
  const actual = await vi.importActual<typeof import('docx')>('docx')
  return {
    ...actual,
    Packer: {
      toBuffer: vi.fn(async () => new Uint8Array([1, 2, 3, 4, 5])),
    },
  }
})

// Mock stripComplianceMarks — pass-through
vi.mock('@/lib/editor/compliance-gap-mark', () => ({
  stripComplianceMarks: vi.fn((json: JSONContent) => json),
}))

import { getUser, createClient } from '@/lib/supabase/server'

const mockGetUser = vi.mocked(getUser)
const mockCreateClient = vi.mocked(createClient)

function makeSupabaseChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data, error }))
  // Make awaiting the chain directly (for select without .single()) work
  ;(chain as unknown as Promise<unknown>)[Symbol.iterator]
  // Override the chain to resolve as { data, error } when awaited directly
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data, error }),
  })
  return chain
}

function makeSupabaseWithSections(sections: unknown[]) {
  const proposalChain: Record<string, unknown> = {}
  proposalChain.from = vi.fn(() => proposalChain)
  proposalChain.select = vi.fn(() => proposalChain)
  proposalChain.eq = vi.fn(() => proposalChain)
  proposalChain.order = vi.fn(() => proposalChain)
  proposalChain.single = vi.fn(async () => ({ data: { title: 'Test Proposal' }, error: null }))

  const sectionsChain: Record<string, unknown> = {}
  sectionsChain.select = vi.fn(() => sectionsChain)
  sectionsChain.eq = vi.fn(() => sectionsChain)
  sectionsChain.order = vi.fn(() => sectionsChain)
  Object.defineProperty(sectionsChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data: sections, error: null }),
  })

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'proposals') return proposalChain
      return sectionsChain
    }),
  }
  return client
}

describe('POST /api/proposals/[id]/export/docx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated request', async () => {
    mockGetUser.mockResolvedValue(null)

    const { POST } = await import('@/app/api/proposals/[id]/export/docx/route')
    const req = new Request('http://localhost/api/proposals/test-id/export/docx', { method: 'POST' })
    const params = Promise.resolve({ id: 'test-id' })
    const res = await POST(req, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when proposal has no sections', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    } as never)

    const client = makeSupabaseWithSections([])
    // Override sections to return empty
    client.from = vi.fn((table: string) => {
      if (table === 'proposals') {
        const ch: Record<string, unknown> = {}
        ch.select = vi.fn(() => ch)
        ch.eq = vi.fn(() => ch)
        ch.single = vi.fn(async () => ({ data: { title: 'Test' }, error: null }))
        return ch
      }
      const ch: Record<string, unknown> = {}
      ch.select = vi.fn(() => ch)
      ch.eq = vi.fn(() => ch)
      ch.order = vi.fn(() => ch)
      Object.defineProperty(ch, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      })
      return ch
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await import('@/app/api/proposals/[id]/export/docx/route')
    const req = new Request('http://localhost/api/proposals/test-id/export/docx', { method: 'POST' })
    const params = Promise.resolve({ id: 'test-id' })
    const res = await POST(req, { params })
    expect(res.status).toBe(404)
  })

  it('returns 200 with correct Content-Type header', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    } as never)

    const mockSections = [
      { section_name: 'Executive Summary', content: { type: 'doc', content: [] } as JSONContent },
    ]
    const client = makeSupabaseWithSections(mockSections)
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await import('@/app/api/proposals/[id]/export/docx/route')
    const req = new Request('http://localhost/api/proposals/test-id/export/docx', { method: 'POST' })
    const params = Promise.resolve({ id: 'test-id' })
    const res = await POST(req, { params })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  })

  it('returns Content-Disposition attachment header with filename', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    } as never)

    const mockSections = [
      { section_name: 'Executive Summary', content: { type: 'doc', content: [] } as JSONContent },
    ]
    const client = makeSupabaseWithSections(mockSections)
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await import('@/app/api/proposals/[id]/export/docx/route')
    const req = new Request('http://localhost/api/proposals/test-id/export/docx', { method: 'POST' })
    const params = Promise.resolve({ id: 'test-id' })
    const res = await POST(req, { params })
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('.docx')
  })

  it('returns non-empty body', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    } as never)

    const mockSections = [
      { section_name: 'Executive Summary', content: { type: 'doc', content: [] } as JSONContent },
    ]
    const client = makeSupabaseWithSections(mockSections)
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await import('@/app/api/proposals/[id]/export/docx/route')
    const req = new Request('http://localhost/api/proposals/test-id/export/docx', { method: 'POST' })
    const params = Promise.resolve({ id: 'test-id' })
    const res = await POST(req, { params })
    const body = await res.arrayBuffer()
    expect(body.byteLength).toBeGreaterThan(0)
  })
})
