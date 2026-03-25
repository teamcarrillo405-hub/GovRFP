import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, 'tests/.auth/admin.json')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3004',
    storageState: authFile,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'fast',
      testMatch: /(?!pipeline).*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pipeline',
      testMatch: /pipeline\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], actionTimeout: 120_000 },
      timeout: 180_000,
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3004',
    url: 'http://localhost:3004',
    reuseExistingServer: !process.env.CI,
  },
})
