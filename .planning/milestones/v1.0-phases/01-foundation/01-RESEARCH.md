# Phase 1: Foundation — Research

**Researched:** 2026-03-23
**Domain:** Next.js 16 + Supabase Auth + Stripe Subscriptions + Postgres Schema + RLS
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can create an account with email and password | Supabase `signUp()` pattern confirmed; PKCE flow for SSR documented |
| AUTH-02 | User receives email verification link and must verify before access | `confirmEmailOnSignup` enabled by default; `/auth/confirm` route handler pattern confirmed |
| AUTH-03 | User can log in with email/password and remain logged in across sessions | `@supabase/ssr` cookie-based session persistence confirmed for App Router |
| AUTH-04 | User can request a password reset via email | `resetPasswordForEmail()` + OTP verify pattern confirmed |
| AUTH-05 | Per-user data isolation via RLS; no cross-account access | `auth.uid()` RLS policy pattern confirmed; `(select auth.uid())` caching optimization documented |
| BILLING-01 | 14-day free trial without entering payment information | `trial_period_days=14` + `payment_method_collection=if_required` + `trial_settings[end_behavior][missing_payment_method]=cancel` confirmed |
| BILLING-02 | Subscribe via Stripe Checkout at any time | Stripe Checkout subscription flow with `subscription_data.trial_period_days` confirmed |
| BILLING-03 | Lose AI/new proposal access on lapse; existing proposals read-only | Subscription status check in proxy.ts + DB column `subscription_status` pattern documented |
| BILLING-04 | View subscription status and next billing date in account settings | Stripe Customer Portal session (`billingPortal.sessions.create`) returns this data |
| BILLING-05 | Cancel at any time from account settings | Stripe Customer Portal `billingPortal.sessions.create` redirect confirmed |
| PROFILE-01 | Create/edit contractor profile: company, UEI/CAGE, certifications, NAICS | Postgres table + Zod schema; form with Server Actions |
| PROFILE-02 | Add/edit/delete past project records with full contract fields | Child table `past_projects` with FK to `profiles`; RLS per-user |
| PROFILE-03 | Add/edit/delete key personnel records | Child table `key_personnel` with FK to `profiles`; RLS per-user |
| PROFILE-04 | Write capability statement narrative (up to 2000 chars) | `TEXT` column with `CHECK (char_length(capability_statement) <= 2000)` constraint |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire scaffolding that every subsequent phase depends on: a working Next.js 16 application, Supabase Auth with email/password and PKCE email verification, per-user Postgres schema with Row Level Security, Stripe subscription billing with a 14-day no-card-required trial, and a contractor profile editor (certifications, NAICS codes, past projects, key personnel, capability statement).

The key architectural decisions locked in this phase are: (1) `@supabase/ssr` for session management — not the deprecated `@supabase/auth-helpers-nextjs`, (2) Stripe subscription status stored on the `profiles` table and checked in `proxy.ts` (Next.js 16's renamed middleware), and (3) `subscription_status` gating in both proxy.ts and individual API route guards — never rely on proxy alone. This phase also creates the full database schema, including the `proposals` table stub, so the schema is tested with RLS before any documents are stored.

The most consequential finding from this research is that the project stack described in prior research used "Next.js 15" but the current `latest` on npm is Next.js 16.2.1 (stable, released October 2025). Next.js 16 renames `middleware.ts` to `proxy.ts`, requires async `cookies()`/`params`, drops Node.js 18, and makes Turbopack the default bundler. All plan tasks should target Next.js 16 directly — starting on 15 and migrating is not recommended for a greenfield project in March 2026.

**Primary recommendation:** Bootstrap with `npx create-next-app@latest` (Next.js 16 + React 19.2 + Tailwind v4), install `@supabase/supabase-js @supabase/ssr stripe @stripe/stripe-js zod`, configure `proxy.ts` (not `middleware.ts`) for session refresh + subscription gating, and use the Stripe Customer Portal for BILLING-04 and BILLING-05 instead of building custom cancel/status UI.

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md found in project root. Constraints sourced from PROJECT.md and REQUIREMENTS.md instead:

- **AI engine:** Claude API only (Anthropic) — no OpenAI or other providers
- **Stack:** Next.js + Supabase (consistent with GovRFP investment)
- **Pricing model:** Per-seat SaaS subscription; no freemium in MVP
- **User model:** Solo accounts only in MVP; no team/org multi-seat
- **Billing:** 14-day trial without credit card; then Stripe Checkout
- **Out of scope (do not add):** Direct portal submission, RFP discovery, real-time collaboration, custom AI fine-tuning, automated pricing generation

---

## Standard Stack

### Core (Phase 1 installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | Full-stack React framework | Current stable; Turbopack default; proxy.ts (renamed middleware); async cookies/params required |
| react | 19.2.4 | UI runtime | Required peer dep for Next.js 16 |
| react-dom | 19.2.4 | DOM renderer | Required peer dep for Next.js 16 |
| typescript | 5.x | Type safety | Minimum 5.1.0 required by Next.js 16; strict mode for schema safety |
| tailwindcss | 4.2.2 | Utility CSS | v4 uses `@import "tailwindcss"` in globals.css; PostCSS plugin is `@tailwindcss/postcss` |
| @tailwindcss/postcss | 4.2.2 | Tailwind v4 PostCSS integration | Required for v4 in Next.js; replaces `tailwindcss` as the PostCSS plugin |
| @supabase/supabase-js | 2.100.0 | Supabase client | Core SDK; use server client for RSC and client for browser components |
| @supabase/ssr | 0.9.0 | Supabase Auth for Next.js App Router | Cookie-based session; replaces deprecated `@supabase/auth-helpers-nextjs` |
| stripe | 20.4.1 | Stripe server SDK | Subscription creation, webhook handling, Customer Portal sessions |
| @stripe/stripe-js | 8.11.0 | Stripe browser SDK | Redirect to Checkout client-side; do not expose secret key in client |
| zod | 4.3.6 | Runtime schema validation | Profile form validation; webhook payload parsing; strict TypeScript integration |

### Supporting (Phase 1)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.95.2 | Client async state | Profile form optimistic updates; subscription status polling |
| eslint | included | Linting | `@typescript-eslint/no-explicit-any` rule mandatory |

### Dev Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| supabase CLI | 2.75.0 (installed) | Local DB, migrations, type gen | `supabase gen types typescript` after every migration |
| stripe CLI | NOT INSTALLED | Local webhook forwarding | Must install before billing tasks; `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| playwright | 1.58.2 | E2E testing | Auth flows require browser-level tests; unit tests are insufficient for Supabase cookie behavior |
| vitest | 4.1.1 | Unit/integration tests | Schema validation, Zod validators, billing logic |

**Installation:**

```bash
# Bootstrap (Next.js 16 + React 19 + Tailwind v4 + TypeScript)
npx create-next-app@latest hcc-proposal-ai --typescript --tailwind --app --src-dir

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Billing
npm install stripe @stripe/stripe-js

# Validation + state
npm install zod @tanstack/react-query

# Dev tools
npm install -D @playwright/test vitest @vitejs/plugin-react

# Test Playwright browsers
npx playwright install chromium
```

**Stripe CLI installation (required before billing tasks):**

```bash
# Windows — via scoop or direct download
scoop install stripe
# Or: https://docs.stripe.com/stripe-cli#install
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Customer Portal | Custom cancel/status UI | Portal is free, handles edge cases (prorations, failed payments), less code; custom UI only needed if brand-critical |
| proxy.ts subscription check | Check only in page components | Middleware ensures API routes also protected; page-only check misses direct API calls |
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated — bug fixes go to @supabase/ssr only |
| Vitest | Jest | Vitest is faster, has native ESM support, less config; Jest requires more setup for Next.js 16 |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Email/password login form
│   │   ├── signup/page.tsx         # Signup form
│   │   ├── reset-password/page.tsx # Request reset form
│   │   └── update-password/page.tsx # New password form (after email link)
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Auth + subscription gate (server component)
│   │   ├── dashboard/page.tsx      # Main dashboard
│   │   ├── profile/page.tsx        # Contractor profile editor
│   │   └── account/page.tsx        # Subscription status + cancel
│   ├── auth/
│   │   └── confirm/route.ts        # PKCE email verification handler
│   └── api/
│       └── webhooks/
│           └── stripe/route.ts     # Stripe webhook handler
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createServerClient + getUser()
│   │   └── client.ts               # createBrowserClient (singleton)
│   └── stripe/
│       └── server.ts               # Stripe instance + helpers
├── components/
│   ├── auth/                       # LoginForm, SignupForm, etc.
│   └── profile/                    # ProfileForm, PastProjectForm, etc.
└── proxy.ts                        # Session refresh + subscription gating
```

### Pattern 1: Supabase SSR Client Setup

**What:** Two client factories — server (for RSC/Actions/Routes) and browser (singleton for client components).

**When to use:** Every data access call. Never use the browser client in server code.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()  // async required in Next.js 16
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Safely ignore — Server Components can't write cookies
          }
        },
      },
    }
  )
}

export const getUser = async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
```

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
```

### Pattern 2: proxy.ts — Session Refresh + Subscription Gating

**What:** Next.js 16's `proxy.ts` (renamed from `middleware.ts`) — runs on every request to refresh Supabase session tokens and check subscription status.

**Critical note:** The file is named `proxy.ts` in Next.js 16. `middleware.ts` still works but is deprecated. Start with `proxy.ts` for new projects.

**When to use:** Every request to `/dashboard` and `/api/*` routes.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// proxy.ts (project root or src/)
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — MUST call getUser() not getSession() for security
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/api/generate') ||
    request.nextUrl.pathname.startsWith('/api/proposals')

  // Redirect unauthenticated users
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

**Note:** Subscription status check (BILLING-03) belongs in the individual dashboard layout Server Component or API route guard — not proxy.ts. Proxy.ts is stateless and fetching subscription from DB on every request is expensive. Check subscription lazily per route.

### Pattern 3: Email Verification Callback Route

**What:** The PKCE flow requires a server-side route to exchange the `token_hash` from the verification email link.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr
// app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) redirect(next)
  }
  redirect('/auth/auth-code-error')
}
```

**Email template config required:** Supabase dashboard email template must send users to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. The default template does NOT use this URL pattern — it must be updated manually in Supabase Auth settings.

### Pattern 4: Stripe Webhook Handler

**What:** The authoritative source of truth for subscription state. Never provision or revoke access based on the Checkout redirect URL — always on webhook events.

**Critical events to handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update `stripe_subscription_id` on profiles row |
| `invoice.paid` | Set `subscription_status = 'active'`; update `current_period_end` |
| `customer.subscription.trial_will_end` | Send reminder email (3 days before trial ends) |
| `customer.subscription.updated` | Sync status changes (trialing → active, active → past_due) |
| `customer.subscription.deleted` | Set `subscription_status = 'canceled'`; revoke AI/proposal creation |
| `invoice.payment_failed` | Set `subscription_status = 'past_due'`; notify user |

```typescript
// Source: https://docs.stripe.com/billing/subscriptions/webhooks
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()  // async in Next.js 16
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Use Supabase admin client (bypasses RLS) for webhook updates
  const supabase = createAdminClient()

  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          current_period_end: new Date(invoice.period_end * 1000).toISOString(),
        })
        .eq('stripe_customer_id', invoice.customer)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('profiles')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', sub.customer)
      break
    }
    // Handle other events...
  }

  return NextResponse.json({ received: true })
}

export const config = { api: { bodyParser: false } }
```

**Webhook must be idempotent:** Same event may arrive twice. Use Stripe event ID to deduplicate or make each update idempotent (upsert/set the same value = no-op).

### Pattern 5: Stripe Checkout — Trial + Subscription

**What:** Create a Checkout session with 14-day trial and no upfront payment method required.

```typescript
// Source: https://docs.stripe.com/billing/subscriptions/trials
// app/api/billing/checkout/route.ts
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  // Create or retrieve Stripe customer
  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email! })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
    payment_method_collection: 'if_required',  // No card required during trial
    success_url: `${process.env.NEXT_PUBLIC_URL}/account?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/account?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
```

### Pattern 6: Database Schema + RLS

**What:** Core Postgres schema with per-user Row Level Security. All user-owned tables reference `auth.users` via foreign key with cascade delete.

```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data

-- Profiles table (1:1 with auth.users)
create table public.profiles (
  id            uuid not null references auth.users on delete cascade,
  -- Billing
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  subscription_status   text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  -- Contractor identity
  company_name          text,
  uei_cage              text,
  -- Certifications (array of enum values)
  certifications        text[] default '{}',
  naics_codes           text[] default '{}',
  -- Capability statement (PROFILE-04)
  capability_statement  text check (char_length(capability_statement) <= 2000),
  -- Metadata
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (id)
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Past projects (PROFILE-02)
create table public.past_projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  contract_number   text,
  agency            text,
  contract_value    bigint,           -- cents
  period_start      date,
  period_end        date,
  scope_narrative   text,
  naics_code        text,
  outcome           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.past_projects enable row level security;

create policy "Users can manage own past_projects"
  on past_projects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Key personnel (PROFILE-03)
create table public.key_personnel (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,
  title           text,
  experience      text,
  certifications  text[] default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.key_personnel enable row level security;

create policy "Users can manage own key_personnel"
  on key_personnel for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Proposals stub (needed for RLS testing in Phase 1; content populated in Phase 4)
create table public.proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null default 'Untitled Proposal',
  status      text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.proposals enable row level security;

create policy "Users can manage own proposals"
  on proposals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Auto-create profile on user signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, trial_ends_at)
  values (new.id, now() + interval '14 days');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Performance: index policy columns
create index on past_projects (user_id);
create index on key_personnel (user_id);
create index on proposals (user_id);
create index on profiles (stripe_customer_id);
```

### Anti-Patterns to Avoid

- **`middleware.ts` in Next.js 16:** File is deprecated. Use `proxy.ts` with exported function named `proxy`, not `middleware`.
- **`getSession()` on server:** Use `getUser()` for server-side auth checks — `getSession()` doesn't validate JWT against Supabase's public keys and can trust stale client-side data.
- **Provisioning on redirect URL:** The `success_url` redirect is user-controllable. Always provision/revoke via webhook events. The redirect is only for UX feedback.
- **Importing `stripe` or `@anthropic-ai/sdk` in client components:** These expose secret keys. Server-only — API routes and Server Actions only.
- **Checking subscription only on page load:** Check `subscription_status` in Server Component layout AND in each API route that performs AI actions. Proxy.ts alone is insufficient.
- **`@supabase/auth-helpers-nextjs`:** Deprecated. Will break with future Next.js updates. Use `@supabase/ssr` only.
- **Sync `cookies()` in Next.js 16:** Must be `await cookies()`. Next.js 16 enforces async for all dynamic APIs.
- **Storing subscription status only in Stripe:** Always mirror to your DB (`subscription_status` column). Stripe API calls from every request are slow and fragile.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password reset flow | Custom token generation + email | Supabase Auth `resetPasswordForEmail()` | Handles token expiry, secure storage, rate limiting |
| Email verification | Custom OTP or magic links | Supabase PKCE flow | Handles token storage, expiry, replay prevention |
| Subscription status page | Custom portal UI | Stripe Customer Portal session | Free, handles payment method updates, cancellations, invoice history, proration display |
| Subscription cancellation | `stripe.subscriptions.cancel()` direct | Stripe Customer Portal | Portal handles immediate vs. end-of-period cancel, downgrades, reactivation |
| JWT validation | Manual JWT decode + verify | `supabase.auth.getUser()` | Validates against Supabase's published JWK endpoint; manual decode misses revocation |
| RLS bypass for service operations | Application-layer `user_id = req.userId` checks | Supabase Row Level Security | RLS cannot be bypassed via SQL injection; application-layer checks can |

**Key insight:** Auth and billing are well-solved problems. Custom implementations create security vulnerabilities (auth) and billing edge cases (failed renewals, prorations, SCA compliance). Use the platform.

---

## Common Pitfalls

### Pitfall 1: Supabase Email Template Not Updated

**What goes wrong:** After signup, the verification email links to `/auth/confirm?token=...` using the default template URL, not `/auth/confirm?token_hash=...` which the PKCE route handler expects. Users click the link, get a 404 or error page, and cannot verify.

**Why it happens:** Supabase's default email confirmation template does not use the PKCE `token_hash` format by default — it uses the older implicit flow token format.

**How to avoid:** In the Supabase dashboard under Authentication > Email Templates > Confirm signup, update the confirmation URL to:
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
```
This must be done before any user signs up. Also add the site URL to the redirect URL allowlist in Supabase Auth settings.

**Warning signs:** `supabase.auth.verifyOtp()` returns an error even with a valid link; users report "verification link not working."

### Pitfall 2: Stripe Webhook Only Handles `checkout.session.completed`

**What goes wrong:** App provisions access on `checkout.session.completed` but never handles `invoice.paid`. After the first monthly renewal, the user's access is not re-confirmed (or revoked if payment fails). The `invoice.paid` event is the canonical provisioning event for recurring subscriptions.

**Why it happens:** The checkout event fires once; `invoice.paid` fires every billing cycle. Many tutorials only show the checkout event.

**How to avoid:** Handle both. After the free trial ends and the first invoice is paid, `invoice.paid` fires with `subscription.status = 'active'`. Set `subscription_status = 'active'` on this event, not just on checkout.

**Critical events minimum set:**
- `checkout.session.completed` — link subscription ID to user profile
- `invoice.paid` — provision/confirm active access each cycle
- `customer.subscription.deleted` — revoke access
- `invoice.payment_failed` — set `past_due`, notify user
- `customer.subscription.trial_will_end` — send 3-day reminder

### Pitfall 3: proxy.ts Doesn't Refresh Session Tokens

**What goes wrong:** Users stay logged in for a day, then suddenly get redirect-looped to the login page. Session tokens expire and are not refreshed because the server Supabase client isn't called on every request.

**Why it happens:** Supabase sessions have short-lived access tokens. The `proxy.ts` file must call `supabase.auth.getUser()` (which internally refreshes the token via the refresh token in the cookie) on every relevant request.

**How to avoid:** The proxy.ts code must call `await supabase.auth.getUser()` — not `getSession()`. This triggers token refresh. Do not skip this call for performance reasons.

### Pitfall 4: Stripe Trial Without `payment_method_collection=if_required`

**What goes wrong:** Stripe Checkout redirects users to a payment form even during the free trial. Users abandon the flow because they don't want to enter a card for a "free" trial.

**Why it happens:** Checkout's default `payment_method_collection` is `always`. For a no-card trial, it must explicitly be set to `if_required`.

**How to avoid:** Always pair `trial_period_days` with `payment_method_collection: 'if_required'` and `trial_settings.end_behavior.missing_payment_method: 'cancel'` in the same Checkout session creation call.

### Pitfall 5: RLS SELECT Policy Missing for UPDATE

**What goes wrong:** Profile update API returns a "permission denied" error even though the UPDATE policy exists, because there is no SELECT policy on the same table.

**Why it happens:** Postgres RLS requires a SELECT policy to exist before UPDATE can succeed — the row must be "visible" to be updated. This is a documented Supabase behavior.

**How to avoid:** Always create a matching SELECT policy for every table that has UPDATE or DELETE policies. The `with check` on INSERT and the `using` on SELECT/UPDATE/DELETE are distinct checks.

### Pitfall 6: `contract_value` Stored as Float

**What goes wrong:** Contract values like `$1,234,567.89` accumulate floating-point rounding errors when stored as `FLOAT` or `DECIMAL`. The value 1234567.89 may round to 1234567.8900000001.

**Why it happens:** IEEE 754 float representation. Common pattern for money values.

**How to avoid:** Store all monetary values as `BIGINT` in cents (1234567 = $12,345.67). Display with division/formatting in the UI. This avoids float errors and matches Stripe's internal representation.

---

## Code Examples

### Auto-create Profile on Signup (Server Action)

```typescript
// Source: Supabase auth.signUp() + trigger pattern
// app/(auth)/signup/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function signUpAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_URL}/auth/confirm`,
    },
  })

  if (error) return { error: error.message }
  redirect('/check-email')  // Tell user to check their inbox
}
```

### Subscription Status Guard in Dashboard Layout

```typescript
// app/(dashboard)/layout.tsx
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  // Allow active and trialing; block canceled and past_due
  const hasAccess = profile?.subscription_status === 'active' ||
    (profile?.subscription_status === 'trialing' &&
      profile.trial_ends_at &&
      new Date(profile.trial_ends_at) > new Date())

  return (
    <div>
      {!hasAccess && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 text-center text-sm">
          Your trial has ended.{' '}
          <a href="/account" className="font-medium underline">Subscribe to continue</a>
        </div>
      )}
      {children}
    </div>
  )
}
```

### Stripe Customer Portal Redirect (BILLING-04 + BILLING-05)

```typescript
// app/api/billing/portal/route.ts
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_URL}/account`,
  })

  return NextResponse.json({ url: portalSession.url })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (deprecated in Next.js 16) | Next.js 16 (Oct 2025) | Must rename file and function for new projects |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 | auth-helpers is deprecated; ssr is the current package |
| Next.js 15 App Router | Next.js 16 App Router | Oct 2025 | Node 20.9+ required; async params/cookies enforced; Turbopack default |
| `tailwind.config.ts` | `@import "tailwindcss"` in CSS + `@tailwindcss/postcss` | Tailwind v4 | Config file optional; CSS-first approach is the v4 default |
| Sync `cookies()`, `headers()` | `await cookies()`, `await headers()` | Next.js 16 | All dynamic APIs are now async — build fails with sync access |
| `supabase.auth.getSession()` on server | `supabase.auth.getUser()` on server | ~2024 | `getSession` is insecure on server — trusts unvalidated client data |
| `trial_period_days` alone | `trial_period_days` + `payment_method_collection: 'if_required'` | Stripe API change | Without `if_required`, trial users are required to enter card |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated; bug fixes stopped; will break with Next.js updates
- Next.js `middleware.ts`: Deprecated in Next.js 16; functional but logs deprecation warning; remove in v17
- `supabase.auth.getSession()` on server: Insecure — still works but should not be used for auth checks

---

## Open Questions

1. **Per-user token budget UX (noted in STATE.md as blocker)**
   - What we know: An `ai_usage_log` table tracking Claude token consumption is the right data model; the schema can be created in Phase 1 even if the enforcement logic comes in Phase 3+
   - What's unclear: Hard cutoff vs. soft warning; whether "trial users" get a reduced token budget vs. paid users; what counts toward the limit (drafts only? analysis? regenerations?)
   - Recommendation: Create the `ai_usage_log` table in this phase's schema migration with `tokens_input`, `tokens_output`, `cost_cents`, `model`, `operation_type`, `proposal_id` columns. Add the product decision about limits to STATE.md as a blocker for Phase 3. Do not block Phase 1 on this decision.

2. **Supabase new publishable key format**
   - What we know: The Supabase docs now reference `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new format `sb_publishable_xxx`) replacing the older anon key
   - What's unclear: Whether existing projects on older anon key format need to migrate, or if both work simultaneously
   - Recommendation: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` as env var name if project is already on the old format; use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for new projects. Both point to the same value. Document in `.env.local.example`.

3. **Stripe CLI installation (Windows)**
   - What we know: Stripe CLI is NOT installed on this machine (confirmed via `command -v stripe`)
   - What's unclear: Preferred install method (scoop, direct download, npm)
   - Recommendation: Add a Wave 0 task to install Stripe CLI via `scoop install stripe` or direct download from https://docs.stripe.com/stripe-cli#install before any billing task runs. Without this, webhook testing is impossible.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime | Yes | 24.13.1 | — |
| npm | Package management | Yes | 11.8.0 | — |
| npx | create-next-app | Yes | 11.8.0 | — |
| Supabase CLI | DB migrations, type gen, local dev | Yes | 2.75.0 | — |
| Stripe CLI | Webhook testing in local dev | **NO** | — | Manual webhook events via Stripe dashboard (workaround only; not acceptable for full dev loop) |
| Git | Version control | Yes | (in git repo) | — |

**Missing dependencies with no viable fallback:**
- **Stripe CLI:** Required for local webhook forwarding. Without it, billing flows cannot be end-to-end tested locally. Install before Wave 2 (billing tasks).

**Missing dependencies with fallback:**
- None (all other dependencies available).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + Playwright 1.58.2 |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | signUp() creates user in Supabase | E2E | `playwright test auth/signup.spec.ts` | Wave 0 |
| AUTH-02 | Email verification route handler processes token_hash | Unit | `vitest run tests/auth/confirm.test.ts` | Wave 0 |
| AUTH-03 | Session persists across page reload | E2E | `playwright test auth/session-persistence.spec.ts` | Wave 0 |
| AUTH-04 | Password reset email sent and link functional | E2E | `playwright test auth/password-reset.spec.ts` | Wave 0 |
| AUTH-05 | User A cannot read User B's proposals via direct query | Integration | `vitest run tests/rls/cross-user-isolation.test.ts` | Wave 0 |
| BILLING-01 | Checkout session created with no payment required | Unit | `vitest run tests/billing/trial-checkout.test.ts` | Wave 0 |
| BILLING-02 | Stripe Checkout redirects to hosted page | E2E | `playwright test billing/checkout.spec.ts` | Wave 0 |
| BILLING-03 | Canceled subscription blocks AI/new proposals | Integration | `vitest run tests/billing/access-gate.test.ts` | Wave 0 |
| BILLING-04 | Billing portal session returns valid URL | Unit | `vitest run tests/billing/portal.test.ts` | Wave 0 |
| BILLING-05 | Cancel flow reaches Stripe portal | E2E | `playwright test billing/cancel.spec.ts` | Wave 0 |
| PROFILE-01 | Profile save persists certifications and NAICS | Integration | `vitest run tests/profile/profile-crud.test.ts` | Wave 0 |
| PROFILE-02 | Past project CRUD with RLS | Integration | `vitest run tests/profile/past-projects.test.ts` | Wave 0 |
| PROFILE-03 | Key personnel CRUD with RLS | Integration | `vitest run tests/profile/key-personnel.test.ts` | Wave 0 |
| PROFILE-04 | Capability statement enforces 2000-char limit | Unit | `vitest run tests/profile/capability-statement.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run` (unit + integration only; < 30 seconds)
- **Per wave merge:** `npx vitest run && npx playwright test --project=chromium`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All test files are missing — project is greenfield:

- [ ] `vitest.config.ts` — test framework configuration
- [ ] `playwright.config.ts` — E2E test configuration (baseURL, browser)
- [ ] `tests/setup.ts` — Vitest global setup (test Supabase client, Stripe test keys)
- [ ] `tests/auth/confirm.test.ts` — covers AUTH-02
- [ ] `tests/auth/session-persistence.spec.ts` (Playwright) — covers AUTH-03
- [ ] `tests/rls/cross-user-isolation.test.ts` — covers AUTH-05 (CRITICAL: run before any file storage added)
- [ ] `tests/billing/trial-checkout.test.ts` — covers BILLING-01
- [ ] `tests/billing/access-gate.test.ts` — covers BILLING-03
- [ ] `tests/profile/profile-crud.test.ts` — covers PROFILE-01
- [ ] `tests/profile/capability-statement.test.ts` — covers PROFILE-04

---

## Sources

### Primary (HIGH confidence)

- [Supabase Auth with Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs) — createServerClient, createBrowserClient, cookie handling pattern, getUser() vs getSession()
- [Supabase PKCE Flow for SSR](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr) — `/auth/confirm` route handler, verifyOtp(), email template requirements
- [Supabase Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) — profiles table pattern, handle_new_user() trigger, on delete cascade
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — auth.uid() pattern, SELECT policy requirement for UPDATE, index optimization
- [Stripe Subscription Trials](https://docs.stripe.com/billing/subscriptions/trials) — trial_period_days, payment_method_collection=if_required, trial_settings.end_behavior
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — invoice.paid pattern, critical event list, provisioning guidance
- [Stripe Subscription Cancel](https://docs.stripe.com/billing/subscriptions/cancel) — Customer Portal vs direct API, billingPortal.sessions.create
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16) — proxy.ts rename, breaking changes, Node 20.9+ requirement, async params/cookies enforcement
- [Tailwind CSS v4 — Next.js Installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs) — @tailwindcss/postcss, @import "tailwindcss" in globals.css
- npm registry — verified: next@16.2.1, @supabase/ssr@0.9.0, stripe@20.4.1, @stripe/stripe-js@8.11.0, zod@4.3.6, tailwindcss@4.2.2

### Secondary (MEDIUM confidence)

- [Stripe Checkout Quickstart](https://docs.stripe.com/checkout/quickstart) — checkout session creation pattern, success_url redirect handling
- [Stripe Build Subscriptions — Checkout](https://docs.stripe.com/billing/subscriptions/build-subscriptions?ui=checkout) — customer creation flow, trial_period_days in subscription_data
- [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords) — resetPasswordForEmail(), updateUser() post-reset flow

---

## Metadata

**Confidence breakdown:**

- Standard stack (HIGH): All package versions verified against npm registry; Next.js 16 confirmed as current stable (16.2.1); API patterns verified against official Supabase + Stripe docs
- Architecture (HIGH): All patterns sourced from official docs with code examples; proxy.ts rename confirmed from Next.js 16 release notes
- Pitfalls (HIGH): Each pitfall verified from official docs or known behavioral characteristics; email template pitfall is a confirmed common failure mode per Supabase community

**Research date:** 2026-03-23

**Valid until:** 2026-04-23 (30 days — stable APIs; Next.js 16 point releases unlikely to break patterns; Supabase and Stripe APIs are versioned)

**Critical version note for planner:** The project research summary in SUMMARY.md references "Next.js 15" as the recommended version. This research supersedes that — Next.js 16.2.1 is current stable (released October 2025) and should be used for this greenfield project. The primary breaking change relevant to this phase is `middleware.ts` → `proxy.ts`.
