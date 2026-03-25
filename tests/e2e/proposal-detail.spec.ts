/**
 * Proposal detail spec — status display, navigation to analysis / editor
 */
import { test, expect } from '@playwright/test'
import { SeedClient } from '../fixtures/seed'

let analyzedId: string
let readyId: string

test.beforeAll(async () => {
  const seed = new SeedClient()
  const a = await seed.seedAnalyzedProposal('Detail Spec Analyzed')
  const r = await seed.seedReadyProposal('Detail Spec Ready')
  analyzedId = a.proposalId
  readyId = r.proposalId
})

test.afterAll(async () => {
  const seed = new SeedClient()
  await seed.deleteProposal(analyzedId)
  await seed.deleteProposal(readyId)
})

test.describe('Proposal detail page', () => {
  test('analyzed proposal shows analysis link', async ({ page }) => {
    await page.goto(`/proposals/${analyzedId}`)
    await expect(page.getByRole('link', { name: /view analysis|analysis/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('analyzed proposal shows editor link', async ({ page }) => {
    await page.goto(`/proposals/${analyzedId}`)
    await expect(page.getByRole('link', { name: /draft|editor/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('ready (processing) proposal shows status', async ({ page }) => {
    await page.goto(`/proposals/${readyId}`)
    // Status "ready" or "processing" or similar indicator should be visible
    await expect(page.getByText(/ready|processing|queued|pending/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('dashboard shows recent proposals list', async ({ page }) => {
    await page.goto('/dashboard')
    // Both seeded proposals should appear somewhere on the dashboard or proposals list
    await expect(page.getByText(/Detail Spec/i).first()).toBeVisible({ timeout: 10000 })
  })
})
