/**
 * Auth spec — tests that do NOT use storageState (login/logout flow)
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Auth', () => {
  test('redirects / to /login when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/login/)
    await expect(page).toHaveURL(/login/)
  })

  test('redirects /dashboard to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/login/)
    await expect(page).toHaveURL(/login/)
  })

  test('login with valid credentials reaches dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@hcc.com')
    await page.getByLabel(/password/i).fill('1234')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@hcc.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    // Should stay on login and show an error
    await expect(page).toHaveURL(/login/)
    await expect(page.getByText(/invalid|incorrect|error/i).first()).toBeVisible({ timeout: 8000 })
  })
})
