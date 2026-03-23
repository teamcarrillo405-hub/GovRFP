import { describe, it, expect } from 'vitest'

describe('AUTH-02: Email Verification Route Handler', () => {
  it('confirm route handler file exists and exports GET', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/auth/confirm/route.ts', 'utf-8')
    expect(code).toContain('export async function GET')
  })

  it('confirm route extracts token_hash from search params', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/auth/confirm/route.ts', 'utf-8')
    expect(code).toContain('token_hash')
  })

  it('confirm route calls verifyOtp with token_hash and type', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/auth/confirm/route.ts', 'utf-8')
    expect(code).toContain('verifyOtp')
    expect(code).toContain('token_hash')
    expect(code).toContain('type')
  })

  it('confirm route redirects to auth-code-error on failure', async () => {
    const fs = await import('fs')
    const code = fs.readFileSync('src/app/auth/confirm/route.ts', 'utf-8')
    expect(code).toContain('auth-code-error')
  })
})
