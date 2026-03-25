/**
 * Profile spec — edit company profile, past projects, key personnel
 */
import { test, expect } from '@playwright/test'

test.describe('Profile', () => {
  test('can view profile form', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByLabel(/company name/i)).toBeVisible()
  })

  test('can save company name change', async ({ page }) => {
    await page.goto('/profile')
    const input = page.getByLabel(/company name/i)
    await input.clear()
    await input.fill('HCC Test Company')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/saved|success/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('past projects page loads', async ({ page }) => {
    await page.goto('/profile/past-projects')
    await expect(page.getByText(/past project|project/i).first()).toBeVisible()
  })

  test('key personnel page loads', async ({ page }) => {
    await page.goto('/profile/key-personnel')
    await expect(page.getByText(/personnel|staff|team/i).first()).toBeVisible()
  })
})
