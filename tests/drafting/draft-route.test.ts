import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server module — factory cannot reference outer let/const variables (hoisting)
vi.mock('@/lib/supabase/server', () => {
  const mockAuth = { getUser: vi.fn() }
  const mockFrom = vi.fn()
  return {
    createClient: vi.fn(async () => ({
      auth: mockAuth,
      from: mockFrom,
    })),
    getUser: vi.fn(),
    __mockAuth: mockAuth,
    __mockFrom: mockFrom,
  }
})

// Mock subscription check
vi.mock('@/lib/billing/subscription-check', () => ({
  checkSubscription: vi.fn(),
  isSubscriptionActive: vi.fn(),
}))

// Mock Anthropic SDK — must use a class so `new Anthropic()` works
vi.mock('@anthropic-ai/sdk', () => {
  const mockToReadableStream = vi.fn(() => new ReadableStream())
  const mockStream = vi.fn(async () => ({ toReadableStream: mockToReadableStream }))
  class MockAnthropic {
    messages = { stream: mockStream }
  }
  return {
    default: MockAnthropic,
    __mockStream: mockStream,
  }
})

import { POST } from '@/app/api/proposals/[id]/draft/route'
import { GET, PATCH } from '@/app/api/proposals/[id]/sections/route'
import * as supabaseServer from '@/lib/supabase/server'
import * as subscriptionCheck from '@/lib/billing/subscription-check'

function getSupabaseMocks() {
  const mod = supabaseServer as unknown as {
    __mockAuth: { getUser: ReturnType<typeof vi.fn> }
    __mockFrom: ReturnType<typeof vi.fn>
  }
  return {
    mockAuth: mod.__mockAuth,
    mockFrom: mod.__mockFrom,
  }
}

function makeChain(singleData: unknown = null) {
  // Build a chain where most methods return `this` (for chaining)
  // Terminal methods (.single(), .limit() at end) return resolved values
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: singleData, error: null }),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn(),
  }
  // Make all methods return the chain itself unless they already have a resolved mock
  ;['select', 'eq', 'order', 'upsert'].forEach((key) => {
    chain[key].mockReturnValue(chain)
  })
  return chain
}

describe('POST /api/proposals/[id]/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mockFrom.mockReturnValue(makeChain())
    vi.mocked(subscriptionCheck.checkSubscription).mockResolvedValue({
      status: 'none',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: false,
    })
    vi.mocked(subscriptionCheck.isSubscriptionActive).mockReturnValue(false)
  })

  it('returns 401 when user not authenticated', async () => {
    const request = new Request('http://localhost/api/proposals/test-id/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'Executive Summary' }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(401)
  })

  it('returns 402 when subscription inactive', async () => {
    const { mockAuth } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
    vi.mocked(subscriptionCheck.checkSubscription).mockResolvedValue({
      status: 'canceled',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: false,
    })
    vi.mocked(subscriptionCheck.isSubscriptionActive).mockReturnValue(false)

    const request = new Request('http://localhost/api/proposals/test-id/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'Executive Summary' }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(402)
  })

  it('rejects invalid section name', async () => {
    const { mockAuth } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    vi.mocked(subscriptionCheck.checkSubscription).mockResolvedValue({
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: true,
    })
    vi.mocked(subscriptionCheck.isSubscriptionActive).mockReturnValue(true)

    const request = new Request('http://localhost/api/proposals/test-id/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'Invalid Section' }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(400)
  })

  it('accepts valid section name in body and returns SSE stream', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    vi.mocked(subscriptionCheck.checkSubscription).mockResolvedValue({
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: true,
    })
    vi.mocked(subscriptionCheck.isSubscriptionActive).mockReturnValue(true)
    mockFrom.mockReturnValue(makeChain({ rfp_text: 'RFP text', requirements: [] }))

    const request = new Request('http://localhost/api/proposals/test-id/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'Executive Summary' }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('passes instruction to prompt builder when provided', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    vi.mocked(subscriptionCheck.checkSubscription).mockResolvedValue({
      status: 'trialing',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: true,
    })
    vi.mocked(subscriptionCheck.isSubscriptionActive).mockReturnValue(true)
    mockFrom.mockReturnValue(makeChain({ rfp_text: 'RFP content', requirements: [] }))

    const request = new Request('http://localhost/api/proposals/test-id/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'Technical Approach',
        instruction: 'Focus on AI and automation capabilities',
      }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(200)
  })
})

describe('GET /api/proposals/[id]/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user not authenticated', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const request = new Request('http://localhost/api/proposals/test-id/sections')
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(401)
  })

  it('returns sections array for authenticated user', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    const mockSections = [
      { id: 'sec-1', section_name: 'Executive Summary', draft_status: 'draft' },
    ]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockSections, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const request = new Request('http://localhost/api/proposals/test-id/sections')
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(mockSections)
  })
})

describe('PATCH /api/proposals/[id]/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user not authenticated', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const request = new Request('http://localhost/api/proposals/test-id/sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_name: 'Executive Summary',
        content: { type: 'doc', content: [] },
        draft_status: 'edited',
      }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(401)
  })

  it('upserts section and returns updated row', async () => {
    const { mockAuth, mockFrom } = getSupabaseMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    const updatedSection = {
      id: 'sec-1',
      section_name: 'Executive Summary',
      draft_status: 'edited',
      last_saved_at: new Date().toISOString(),
    }
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedSection, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const request = new Request('http://localhost/api/proposals/test-id/sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_name: 'Executive Summary',
        content: { type: 'doc', content: [] },
        draft_status: 'edited',
      }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.section_name).toBe('Executive Summary')
    expect(body.draft_status).toBe('edited')
  })
})
