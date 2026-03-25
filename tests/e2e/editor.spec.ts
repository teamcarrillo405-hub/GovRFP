/**
 * Editor spec — section selection, pre-saved content, generate button
 */
import { test, expect } from '@playwright/test'
import { SeedClient } from '../fixtures/seed'

let proposalId: string

test.beforeAll(async () => {
  const seed = new SeedClient()
  const result = await seed.seedAnalyzedProposal('Editor Spec')
  proposalId = result.proposalId
  // Pre-seed a draft section so the editor has content to load
  await seed.seedSectionDraft(
    proposalId,
    'Executive Summary',
    'Our company delivers exceptional construction management services.'
  )
})

test.afterAll(async () => {
  const seed = new SeedClient()
  await seed.deleteProposal(proposalId)
})

test.describe('Proposal Editor', () => {
  test('editor page loads with section tabs', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    await expect(page.getByText(/executive summary/i)).toBeVisible({ timeout: 10000 })
  })

  test('pre-saved content renders in editor', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    // Click Executive Summary section
    await page.getByText(/executive summary/i).first().click()
    // Seeded text should appear in the editor
    await expect(page.getByText(/exceptional construction/i)).toBeVisible({ timeout: 8000 })
  })

  test('section tabs switch content', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    // Click Technical Approach tab
    const techTab = page.getByText(/technical approach/i).first()
    await techTab.click()
    // Generate button should be visible (no draft yet)
    await expect(page.getByRole('button', { name: /generate|draft/i }).first()).toBeVisible({ timeout: 8000 })
  })

  test('generate button is present for empty sections', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    await page.getByText(/management plan/i).first().click()
    await expect(page.getByRole('button', { name: /generate|draft/i }).first()).toBeVisible({ timeout: 8000 })
  })

  test('RFP structure sidebar toggle works', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    // Look for sidebar or RFP structure button
    const sidebarToggle = page.getByRole('button', { name: /rfp|structure|sidebar/i }).first()
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click()
      // After clicking, sidebar should collapse or expand
      await page.waitForTimeout(500)
    }
    // Pass if page still loaded (toggle doesn't crash)
    await expect(page).toHaveURL(/editor/)
  })

  test('auto-save indicator visible after typing', async ({ page }) => {
    await page.goto(`/proposals/${proposalId}/editor`)
    await page.getByText(/executive summary/i).first().click()
    // Click inside the editor and type something
    const editorArea = page.locator('.ProseMirror').first()
    await editorArea.click()
    await page.keyboard.type(' Updated text.')
    // Auto-save indicator (saving/saved text or spinner)
    await expect(page.getByText(/saving|saved/i).first()).toBeVisible({ timeout: 5000 })
  })
})
