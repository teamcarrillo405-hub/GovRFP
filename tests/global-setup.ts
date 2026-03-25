import { chromium, type FullConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

export default async function globalSetup(config: FullConfig) {
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:3004/login')
  await page.getByLabel(/email/i).fill('admin@hcc.com')
  await page.getByLabel(/password/i).fill('1234')
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await page.context().storageState({ path: path.join(authDir, 'admin.json') })
  await browser.close()
}
