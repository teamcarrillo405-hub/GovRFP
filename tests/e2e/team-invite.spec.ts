/**
 * Team Invite Flow — UAT E2E spec
 *
 * Covers four steps of the full invite lifecycle:
 *   1. User A creates a team by sharing a proposal (via the Share button → SharePanel → InviteForm)
 *   2. User A invites User B by email through the same panel
 *   3. User B accepts the invite via the /invite/accept?invite_id=...&team_id=... route
 *   4. User B logs in and sees the "Shared" badge on the dashboard for User A's proposal
 *
 * Architecture notes (from codebase):
 *   - Team creation: POST /api/teams  (name + proposal_id)
 *   - Invite send:   POST /api/teams/invite  (team_id + email + role)
 *   - Invite accept: /invite/accept?invite_id=<uuid>&team_id=<uuid>  →  POST /api/teams/invite/accept
 *   - "Shared" badge: dashboard/page.tsx renders `isShared = p.team_id && p.user_id !== user.id`
 *
 * Running:
 *   npx playwright test tests/e2e/team-invite.spec.ts
 *
 * Prerequisites:
 *   - App running on http://localhost:3004  (or set BASE_URL env)
 *   - User A and User B accounts exist in Supabase (see TODO comments below)
 *   - User A has at least one proposal in status 'ready' or 'analyzed'
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// ---------------------------------------------------------------------------
// TODO: Replace these with real test-account credentials before running UAT.
// User A is the proposal owner / team creator.
// User B is the invitee who will accept and view the shared proposal.
// ---------------------------------------------------------------------------
const USER_A_EMAIL = 'user-a-test@example.com' // TODO: real User A email
const USER_A_PASSWORD = 'password-a-TODO'       // TODO: real User A password

const USER_B_EMAIL = 'user-b-test@example.com' // TODO: real User B email
const USER_B_PASSWORD = 'password-b-TODO'       // TODO: real User B password

// ---------------------------------------------------------------------------
// If you have a known proposal ID for User A you can hard-code it here so the
// test is deterministic.  Leave as empty string to let the test discover the
// first available proposal from the dashboard list.
// ---------------------------------------------------------------------------
const USER_A_PROPOSAL_ID = '' // TODO: optional — e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3004'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log in as a given user and wait for the dashboard. */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 20_000 })
}

/** Log out by navigating away from any page that has a session. */
async function logout(page: Page) {
  // ProposalAI uses Supabase server-side sessions.
  // The fastest reliable logout for E2E purposes is to call the Supabase
  // signOut endpoint and reload — or just clear storage state.
  await page.evaluate(() => {
    // Belt-and-suspenders: clear localStorage keys Supabase uses client-side
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key)
    })
  })
  await page.goto(`${BASE_URL}/login`)
  await page.waitForURL(/login/, { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Test suite — each step uses a fresh browser context so sessions don't bleed.
// We use test.describe with serial execution so step 2 can rely on step 1.
// ---------------------------------------------------------------------------

test.describe('Team Invite Flow', () => {
  // Opt out of the global storageState — we manage auth ourselves here.
  test.use({ storageState: { cookies: [], origins: [] } })

  /**
   * Shared mutable state passed between steps via closure.
   * In a real CI environment you would persist these via fixtures or a temp file.
   */
  let capturedProposalId: string = USER_A_PROPOSAL_ID
  let capturedInviteId: string = ''
  let capturedTeamId: string = ''

  // -------------------------------------------------------------------------
  // Step 1: User A creates a team
  // -------------------------------------------------------------------------
  test('Step 1 — User A opens a proposal and creates a team via Share panel', async ({
    browser,
  }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_A_EMAIL, USER_A_PASSWORD)

    // Resolve proposal ID — use known ID or discover from dashboard
    let proposalId = capturedProposalId
    if (!proposalId) {
      await page.goto(`${BASE_URL}/dashboard`)
      // Pick the first proposal link in the "Recent Proposals" section
      const firstProposalLink = page.locator(
        'main a[href^="/proposals/"]:not([href="/proposals/new"])'
      ).first()
      await expect(firstProposalLink).toBeVisible({ timeout: 15_000 })
      const href = await firstProposalLink.getAttribute('href')
      proposalId = href?.split('/proposals/')[1] ?? ''
      expect(proposalId).toBeTruthy()
      capturedProposalId = proposalId
    }

    // Navigate directly to the proposal detail page
    await page.goto(`${BASE_URL}/proposals/${proposalId}`)

    // The ShareButton renders "Share" when no team exists yet
    const shareBtn = page.getByRole('button', { name: /^share$/i })
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })
    await shareBtn.click()

    // Share panel (dialog) should appear
    const panel = page.getByRole('dialog', { name: /share proposal/i })
    await expect(panel).toBeVisible({ timeout: 8_000 })

    // Fill in the invite form to create the team + send the first invite
    await page.getByLabel(/teammate email/i).fill(USER_B_EMAIL)

    // Intercept the /api/teams and /api/teams/invite responses to capture IDs
    const [teamsResp, inviteResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/teams') && !r.url().includes('/invite') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ).then((r) => r.json() as Promise<{ team?: { id: string } }>),
      page.waitForResponse(
        (r) => r.url().includes('/api/teams/invite') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ).then((r) => r.json() as Promise<{ invited?: boolean }>),
      page.getByRole('button', { name: /send invite/i }).click(),
    ])

    // Validate team was created
    expect(teamsResp.team?.id).toBeTruthy()
    capturedTeamId = teamsResp.team!.id

    // Validate invite was sent
    expect(inviteResp.invited).toBe(true)

    // Panel should stay open and now show "Manage Team" as button label on next open
    // (button label changes from "Share" to "Manage Team" after team creation)
    await expect(panel).toBeVisible()

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Step 2: User A invites User B — captured as part of Step 1 above.
  // This step validates the invite record exists in the DB by checking
  // User B's dashboard shows a pending invite banner.
  // -------------------------------------------------------------------------
  test('Step 2 — User B sees a pending invite banner on their dashboard', async ({
    browser,
  }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)
    await page.goto(`${BASE_URL}/dashboard`)

    // Dashboard renders pending invites via team_invites query in page.tsx
    const inviteBanner = page
      .getByText(/you've been invited to join a team/i)
      .first()
    await expect(inviteBanner).toBeVisible({ timeout: 15_000 })

    // Capture the accept link to extract invite_id and team_id for step 3
    const acceptLink = page.getByRole('link', { name: /accept/i }).first()
    await expect(acceptLink).toBeVisible()
    const href = await acceptLink.getAttribute('href')
    expect(href).toContain('invite_id=')
    expect(href).toContain('team_id=')

    // Parse IDs from the accept link URL
    const url = new URL(href!, BASE_URL)
    capturedInviteId = url.searchParams.get('invite_id') ?? ''
    capturedTeamId = capturedTeamId || (url.searchParams.get('team_id') ?? '')
    expect(capturedInviteId).toBeTruthy()
    expect(capturedTeamId).toBeTruthy()

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Step 3: User B accepts the invite via /invite/accept route
  // -------------------------------------------------------------------------
  test('Step 3 — User B accepts the invite and sees the success confirmation', async ({
    browser,
  }) => {
    // Skip with a helpful message if prior steps didn't populate IDs
    test.skip(
      !capturedInviteId || !capturedTeamId,
      'Step 3 requires invite_id and team_id captured in Steps 1 & 2'
    )

    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)

    // Navigate to the accept route directly (same path the dashboard "Accept" button uses)
    const acceptUrl = `${BASE_URL}/invite/accept?invite_id=${capturedInviteId}&team_id=${capturedTeamId}`
    await page.goto(acceptUrl)

    // InviteAcceptContent shows "You're in." on success (line 103 in InviteAcceptContent.tsx)
    await expect(page.getByText(/you're in|you are in/i)).toBeVisible({ timeout: 20_000 })

    // The "Go to Proposal" link should also be present
    await expect(page.getByRole('link', { name: /go to proposal/i })).toBeVisible()

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Step 4: User B sees the "Shared" badge on the dashboard for User A's proposal
  // -------------------------------------------------------------------------
  test('Step 4 — User B sees "Shared" badge on the shared proposal in their dashboard', async ({
    browser,
  }) => {
    test.skip(
      !capturedProposalId,
      'Step 4 requires proposalId captured in Step 1'
    )

    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)
    await page.goto(`${BASE_URL}/dashboard`)

    // "Recent Proposals" section renders the Shared badge when:
    //   isShared = p.team_id && p.user_id !== user.id
    // Badge text is "Shared" with class bg-purple-50 text-purple-700
    const sharedBadge = page.getByText('Shared', { exact: true }).first()
    await expect(sharedBadge).toBeVisible({ timeout: 15_000 })

    // Additionally confirm the shared proposal link appears in the list
    const proposalLink = page.locator(`a[href="/proposals/${capturedProposalId}"]`)
    await expect(proposalLink).toBeVisible()

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Bonus: Verify User B can navigate into the proposal (viewer/editor access)
  // -------------------------------------------------------------------------
  test('Bonus — User B can open the shared proposal detail page', async ({
    browser,
  }) => {
    test.skip(
      !capturedProposalId,
      'Bonus step requires proposalId captured in Step 1'
    )

    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)
    await page.goto(`${BASE_URL}/proposals/${capturedProposalId}`)

    // Should NOT redirect to login or 404 — page accessible via team membership
    await expect(page).not.toHaveURL(/login/)
    await expect(page).not.toHaveURL(/not-found|404/)

    // Proposal detail page always shows a "Back to Dashboard" link
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible({
      timeout: 10_000,
    })

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Edge case: accepting an already-used invite shows "Already joined"
  // -------------------------------------------------------------------------
  test('Edge case — re-accepting a used invite shows "Already joined"', async ({
    browser,
  }) => {
    test.skip(
      !capturedInviteId || !capturedTeamId,
      'Edge case requires invite_id and team_id from Steps 1 & 2'
    )

    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)

    const acceptUrl = `${BASE_URL}/invite/accept?invite_id=${capturedInviteId}&team_id=${capturedTeamId}`
    await page.goto(acceptUrl)

    // InviteAcceptContent renders "Already joined" when status is already 'accepted'
    // (API returns error containing 'already', component switches to 'already-member' state)
    await expect(
      page.getByText(/already joined|already have access/i)
    ).toBeVisible({ timeout: 20_000 })

    await context.close()
  })

  // -------------------------------------------------------------------------
  // Edge case: visiting /invite/accept without valid params shows expired state
  // -------------------------------------------------------------------------
  test('Edge case — invalid invite link shows "Invitation expired"', async ({
    browser,
  }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()

    await loginAs(page, USER_B_EMAIL, USER_B_PASSWORD)

    // Use a syntactically valid but non-existent UUID
    const badUrl = `${BASE_URL}/invite/accept?invite_id=00000000-0000-0000-0000-000000000000&team_id=00000000-0000-0000-0000-000000000000`
    await page.goto(badUrl)

    // InviteAcceptContent shows "Invitation expired" for invalid/unknown invites
    await expect(page.getByText(/invitation expired/i)).toBeVisible({ timeout: 20_000 })

    await context.close()
  })
})
