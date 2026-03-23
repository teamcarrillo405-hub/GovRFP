import { describe, it, expect } from 'vitest'
import { isSubscriptionActive } from '@/lib/billing/subscription-check'

describe('BILLING-03: Subscription Access Gating', () => {
  it('trialing status grants access', () => {
    expect(isSubscriptionActive('trialing')).toBe(true)
  })

  it('active status grants access', () => {
    expect(isSubscriptionActive('active')).toBe(true)
  })

  it('past_due status denies access', () => {
    expect(isSubscriptionActive('past_due')).toBe(false)
  })

  it('canceled status denies access', () => {
    expect(isSubscriptionActive('canceled')).toBe(false)
  })

  it('none status denies access', () => {
    expect(isSubscriptionActive('none')).toBe(false)
  })
})
