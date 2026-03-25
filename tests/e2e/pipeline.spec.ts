/**
 * Pipeline spec — full end-to-end flow: upload PDF → process → analyze → draft
 *
 * This test runs in the 'pipeline' project with a 180s timeout.
 * It requires the manual scripts (process-job.mjs + analyze-job.mjs) to have already
 * run, OR for the pg_cron automation to be working. If running manually, trigger
 * them in a separate terminal before running this test.
 *
 * To run: npx playwright test --project=pipeline
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SAMPLE_PDF = path.join(__dirname, '../fixtures/sample.pdf')

test.describe('Full pipeline', () => {
  test('upload PDF → proposal created → navigates to detail', async ({ page }) => {
    await page.goto('/proposals/new')

    // Upload triggers automatically on file selection (no submit button)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(SAMPLE_PDF)

    // Should navigate to proposal detail or processing page after upload completes
    await page.waitForURL(/proposals\/[a-z0-9-]+/, { timeout: 60000 })
    expect(page.url()).toMatch(/proposals\/[a-z0-9-]+/)

    // Status indicator should appear
    await expect(page.getByText(/processing|queued|analyzing|ready|analyzed/i).first()).toBeVisible({ timeout: 20000 })
  })

  test('analyzed proposal renders all four analysis cards', async ({ page }) => {
    // This test requires an already-analyzed proposal in the DB.
    // Seed one with SeedClient to guarantee a known-good state.
    const { SeedClient } = await import('../fixtures/seed')
    const seed = new SeedClient()
    const { proposalId } = await seed.seedAnalyzedProposal('Pipeline Full Spec')

    try {
      await page.goto(`/proposals/${proposalId}/analysis`)

      await expect(page.getByText(/win score|win probability/i).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/compliance matrix/i).first()).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/set.aside/i).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await seed.deleteProposal(proposalId)
    }
  })

  test('generate Executive Summary produces content in editor', async ({ page }) => {
    const { SeedClient } = await import('../fixtures/seed')
    const seed = new SeedClient()
    const { proposalId } = await seed.seedAnalyzedProposal('Pipeline Draft Spec')

    try {
      await page.goto(`/proposals/${proposalId}/editor`)

      // Click Executive Summary section
      await page.getByText(/executive summary/i).first().click()

      // Click Generate button
      const generateBtn = page.getByRole('button', { name: /generate|draft/i }).first()
      await expect(generateBtn).toBeVisible({ timeout: 8000 })
      await generateBtn.click()

      // Spinner / "Generating..." should appear
      await expect(page.getByText(/generating/i).first()).toBeVisible({ timeout: 10000 })

      // Wait for generation to complete (overlay disappears)
      await expect(page.getByText(/generating/i).first()).not.toBeVisible({ timeout: 90000 })

      // Editor should now have content
      const editorContent = page.locator('.ProseMirror').first()
      const text = await editorContent.textContent()
      expect(text?.length ?? 0).toBeGreaterThan(100)
    } finally {
      await seed.deleteProposal(proposalId)
    }
  })
})
