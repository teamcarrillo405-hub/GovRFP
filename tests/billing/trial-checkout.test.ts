import { describe, it, expect } from 'vitest'

describe('BILLING-01: 14-day Trial Without Payment', () => {
  it('checkout route sets trial_period_days to 14', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/api/billing/checkout/route.ts', 'utf-8')
    expect(code).toContain('trial_period_days: 14')
  })

  it('checkout route sets payment_method_collection to if_required', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/api/billing/checkout/route.ts', 'utf-8')
    expect(code).toContain("payment_method_collection: 'if_required'")
  })

  it('checkout route sets missing_payment_method to cancel', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/api/billing/checkout/route.ts', 'utf-8')
    expect(code).toContain("missing_payment_method: 'cancel'")
  })
})
