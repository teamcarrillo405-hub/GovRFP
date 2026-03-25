/**
 * Analysis spec — verifies the analysis page renders seeded data correctly
 */
import { test, expect } from '@playwright/test'
import { SeedClient } from '../fixtures/seed'

let proposalId: string

test.beforeAll(async () => {
  const seed = new SeedClient()
  const result = await seed.seedAnalyzedProposal('Analysis Spec')
  proposalId = result.proposalId
})

test.afterAll(async () => {
  const seed = new SeedClient()
  await seed.deleteProposal(proposalId)
})

test.describe('Analysis page', () => {
  test('shows win score', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/analysis`)
    await expect(page.getByText(/win score|win probability/i).first()).toBeVisible({ timeout: 10000 })
    // Score should be visible (seeded as 72)
    await expect(page.getByText(/72/).first()).toBeVisible()
  })

  test('shows compliance matrix', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/analysis`)
    // At least one requirement row visible
    await expect(page.getByText(/shall|must/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows set-aside flags section', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/analysis`)
    await expect(page.getByText(/set.aside|small business/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('detail page has draft proposal link to editor', async ({ page }) => {
    // The Draft Proposal CTA lives on the proposal detail page, not the analysis page
    await page.goto(`/proposals/${proposalId}`)
    const draftBtn = page.getByRole('link', { name: /draft proposal/i }).first()
    await expect(draftBtn).toBeVisible({ timeout: 10000 })
    await draftBtn.click()
    await page.waitForURL(`**/proposals/${proposalId}/editor`, { timeout: 10000 })
    await expect(page).toHaveURL(/editor/)
  })
})
