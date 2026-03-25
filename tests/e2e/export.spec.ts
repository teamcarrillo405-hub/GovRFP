/**
 * Export spec — Word and PDF export buttons trigger downloads
 */
import { test, expect } from '@playwright/test'
import { SeedClient } from '../fixtures/seed'

let proposalId: string

test.beforeAll(async () => {
  const seed = new SeedClient()
  const result = await seed.seedAnalyzedProposal('Export Spec')
  proposalId = result.proposalId
  // Seed all five sections with content so exports have something to render
  const sections = [
    'Executive Summary',
    'Technical Approach',
    'Management Plan',
    'Past Performance',
    'Price Narrative',
  ]
  for (const s of sections) {
    await seed.seedSectionDraft(proposalId, s, `Draft content for ${s}. This section covers the key requirements.`)
  }
})

test.afterAll(async () => {
  const seed = new SeedClient()
  await seed.deleteProposal(proposalId)
})

test.describe('Export', () => {
  test('export page or button is reachable from editor', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    // Look for export button/link
    const exportEl = page.getByRole('button', { name: /export/i }).or(
      page.getByRole('link', { name: /export/i })
    ).first()
    await expect(exportEl).toBeVisible({ timeout: 10000 })
  })

  test('Word export triggers a .docx download', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /export.*word|word/i }).first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.docx$/)
  })

  test('PDF export triggers a .pdf download', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /export.*pdf|pdf/i }).first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})
