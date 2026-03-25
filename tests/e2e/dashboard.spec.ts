/**
 * Dashboard smoke tests — uses storageState (pre-authenticated)
 */
import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('loads dashboard page', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/dashboard/)
    // Page title or heading visible
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('profile page loads', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText(/company|profile/i).first()).toBeVisible()
  })

  test('new proposal page loads', async ({ page }) => {
    await page.goto('/proposals/new')
    await expect(page.getByText(/upload|rfp/i).first()).toBeVisible()
  })

  test('account/billing page loads', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByText(/subscription|billing|plan/i).first()).toBeVisible()
  })
})
