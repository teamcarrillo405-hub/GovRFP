-- Source: https://supabase.com/docs/guides/auth/managing-user-data
-- Foundation schema: profiles, past_projects, key_personnel, proposals
-- All tables reference auth.users with cascade delete and RLS enabled

-- =============================================================================
-- Profiles table (1:1 with auth.users)
-- =============================================================================
create table public.profiles (
  id                      uuid not null references auth.users on delete cascade,
  -- Billing (synced via Stripe webhooks)
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  subscription_status     text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  -- Contractor identity
  company_name            text,
  uei_cage                text,
  -- Certifications (array: 8(a), HUBZone, SDVOSB, WOSB, etc.)
  certifications          text[] default '{}',
  naics_codes             text[] default '{}',
  -- Capability statement (PROFILE-04: max 2000 chars)
  capability_statement    text check (char_length(capability_statement) <= 2000),
  -- Metadata
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
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

-- =============================================================================
-- Past projects (PROFILE-02)
-- =============================================================================
create table public.past_projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  contract_number text,
  agency          text,
  contract_value  bigint,  -- stored as cents to avoid float rounding errors
  period_start    date,
  period_end      date,
  scope_narrative text,
  naics_code      text,
  outcome         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.past_projects enable row level security;

create policy "Users can manage own past_projects"
  on past_projects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =============================================================================
-- Key personnel (PROFILE-03)
-- =============================================================================
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

-- =============================================================================
-- Proposals stub (content populated in Phase 4; RLS tested in Phase 1)
-- =============================================================================
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

-- =============================================================================
-- Auto-create profile row on new user signup
-- Sets trial_ends_at to now + 14 days (BILLING-01)
-- =============================================================================
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

-- =============================================================================
-- Performance indexes on policy columns
-- =============================================================================
create index on past_projects (user_id);
create index on key_personnel (user_id);
create index on proposals (user_id);
create index on profiles (stripe_customer_id);
