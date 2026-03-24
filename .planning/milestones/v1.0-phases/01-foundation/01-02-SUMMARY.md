---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [supabase, supabase-ssr, next-auth, pkce, zod, tailwind]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold, src/lib/supabase/server.ts createClient + getUser, Tailwind v4

provides:
  - proxy.ts with session refresh via getUser() and auth routing
  - Signup flow with Zod validation and PKCE emailRedirectTo
  - Email verification route at /auth/confirm via verifyOtp
  - Login flow with signInWithPassword redirecting to /dashboard
  - Password reset flow (resetPasswordForEmail + updateUser)
  - All auth pages under (auth) route group with Tailwind card layouts

affects: [02-billing, 03-profile, 04-proposals, 05-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "proxy.ts (not middleware.ts): Next.js 16 session refresh pattern using parseCookieHeader from @supabase/ssr"
    - "Server Actions with 'use server' directive + Zod schema validation before Supabase calls"
    - "PKCE email verification: /auth/confirm GET route exchanges token_hash via verifyOtp"
    - "getUser() not getSession() in proxy.ts: validates JWT against Supabase public keys (security requirement)"

key-files:
  created:
    - src/proxy.ts
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/signup/actions.ts
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/actions.ts
    - src/app/(auth)/reset-password/page.tsx
    - src/app/(auth)/reset-password/actions.ts
    - src/app/(auth)/update-password/page.tsx
    - src/app/(auth)/update-password/actions.ts
    - src/app/(auth)/check-email/page.tsx
    - src/app/auth/confirm/route.ts
    - src/app/auth/auth-code-error/page.tsx
  modified:
    - src/proxy.ts (value coercion fix for parseCookieHeader TypeScript compatibility)

key-decisions:
  - "parseCookieHeader value coercion: map undefined to empty string to satisfy CookieMethodsServer type constraint"
  - "isAuthRoute in proxy.ts checks startsWith not exact match to cover sub-paths like /reset-password/success"
  - "Auth route group uses (auth) not (public) per research architecture pattern"

patterns-established:
  - "Pattern: All server actions use 'use server' + Zod safeParse before any Supabase call"
  - "Pattern: Auth pages are client components ('use client') calling server actions; success handled by server redirect"
  - "Pattern: proxy.ts guards /dashboard, /profile, /account, /api/proposals, /api/generate, /api/billing"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 01 Plan 02: Auth Flow Summary

**Supabase Auth with PKCE email verification, proxy.ts session refresh, and complete login/signup/reset password flow using @supabase/ssr cookie-based sessions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T17:08:00Z
- **Completed:** 2026-03-23T17:12:13Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- proxy.ts exports `proxy` function (Next.js 16 pattern) that calls getUser() on every request and redirects unauthenticated/authenticated users appropriately
- Complete signup-to-verify flow: signUpAction with Zod validation, PKCE emailRedirectTo, /auth/confirm route with verifyOtp, /auth/auth-code-error fallback
- Login, password reset, and update-password server actions with proper Supabase calls and validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy.ts with session refresh and auth routing** - `76123e1` (feat)
2. **Task 2: Create all auth pages, server actions, and email verification route** - `36fad6a` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `src/proxy.ts` - Session refresh + auth routing; exports `proxy` function; uses parseCookieHeader from @supabase/ssr
- `src/app/(auth)/signup/actions.ts` - signUpAction with Zod signupSchema, emailRedirectTo PKCE, redirect to /check-email
- `src/app/(auth)/signup/page.tsx` - Client component signup form with 8-char password validation
- `src/app/(auth)/login/actions.ts` - loginAction with signInWithPassword, redirect to /dashboard on success
- `src/app/(auth)/login/page.tsx` - Client component login form with "Forgot password?" link
- `src/app/(auth)/reset-password/actions.ts` - resetPasswordAction with resetPasswordForEmail
- `src/app/(auth)/reset-password/page.tsx` - Email form + success state after submission
- `src/app/(auth)/update-password/actions.ts` - updatePasswordAction with updateUser, password match check
- `src/app/(auth)/update-password/page.tsx` - New password + confirm fields client form
- `src/app/(auth)/check-email/page.tsx` - Static confirmation page after signup
- `src/app/auth/confirm/route.ts` - GET handler: verifyOtp with token_hash + type, redirect to /dashboard or error
- `src/app/auth/auth-code-error/page.tsx` - Invalid/expired link error page with link back to /signup

## Decisions Made

- parseCookieHeader returns `value?: string | undefined` but CookieMethodsServer requires `value: string`. Fixed by mapping undefined to empty string during getAll(). This is the correct approach per the @supabase/ssr type contract.
- No `getSession()` used anywhere — only `getUser()` in proxy.ts per Supabase security guidance (validates JWT server-side).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed parseCookieHeader TypeScript type mismatch in proxy.ts**
- **Found during:** Task 2 (TypeScript check after creating all files)
- **Issue:** parseCookieHeader returns `{ name: string; value?: string | undefined }[]` but CookieMethodsServer.getAll requires `{ name: string; value: string }[]` — TypeScript error TS2769
- **Fix:** Added .map() to coerce undefined value to empty string: `value: value ?? ''`
- **Files modified:** src/proxy.ts
- **Verification:** `npx tsc --noEmit` exits 0 with no errors
- **Committed in:** `36fad6a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, TypeScript type coercion)
**Impact on plan:** Required fix for correct TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the parseCookieHeader type fix above.

## User Setup Required

None — no external service configuration required for this plan. Auth pages are ready; Supabase project and email templates require configuration completed in Phase 1 setup (env vars set in 01-01).

Note: Supabase email template must be updated in the Supabase dashboard to use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` for the PKCE flow to work. This is a one-time manual step documented in 01-RESEARCH.md Pattern 3.

## Next Phase Readiness

- Auth identity layer complete — all sign-up/login/reset flows functional
- proxy.ts protects all dashboard and API routes
- Ready for Plan 03 (Stripe billing) which will add subscription status checks to proxy.ts

---
*Phase: 01-foundation*
*Completed: 2026-03-23*
