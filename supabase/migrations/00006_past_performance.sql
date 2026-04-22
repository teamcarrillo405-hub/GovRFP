-- ============================================================
-- Phase 06: Past Performance Library
--
-- Stores a contractor firm's prior-contract records (FAR 15.305 past-
-- performance evidence) so the LLM can generate tailored PP narratives
-- for each new proposal instead of rewriting the same stories by hand.
--
-- Trust model (locked design decision):
--   - Team-scoped by default: every row has team_id (nullable for pre-team
--     solo users). All team members can read + write team-scoped rows.
--   - user_id tracked separately as an audit trail — who authored the record.
--   - Solo rows (team_id IS NULL) are readable only by user_id = auth.uid().
--
-- Defensive notes:
--   - `IF NOT EXISTS` on extension, table, indexes, trigger function
--   - Helper function uses the live team_members schema: composite PK
--     (team_id, user_id), no `id` column. Matches what's actually in DB.
--   - SECURITY DEFINER on helper to avoid the profiles-style RLS recursion
--     we caught during the bridge smoke test (see 20260422000001 in GovRFP).
-- ============================================================

-- pgvector for semantic relevance ranking in Week 2. Safe if already installed.
create extension if not exists vector with schema public;

create table if not exists public.past_performance (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  team_id               uuid references public.teams on delete set null,

  -- Core identification
  contract_title        text not null check (length(contract_title) between 1 and 300),
  contract_number       text,
  customer_name         text not null check (length(customer_name) between 1 and 200),
  customer_agency_code  text,
  customer_poc_name     text,
  customer_poc_email    text,

  -- Period + scale
  period_start          date,
  period_end            date check (period_end is null or period_start is null or period_end >= period_start),
  contract_value_usd    numeric(14, 2) check (contract_value_usd is null or contract_value_usd >= 0),
  naics_codes           text[] not null default '{}',
  set_asides_claimed    text[] not null default '{}',

  -- Narrative (evergreen — the LLM tailors this per proposal at draft time)
  scope_narrative       text not null check (length(scope_narrative) between 1 and 5000),
  key_personnel         jsonb not null default '[]'::jsonb,
  outcomes              text check (outcomes is null or length(outcomes) <= 2000),
  cpars_rating          text check (cpars_rating is null or cpars_rating in
                          ('exceptional', 'very_good', 'satisfactory', 'marginal', 'unsatisfactory')),

  -- Metadata
  tags                  text[] not null default '{}',
  -- Populated by an async embedding job on insert/update (1536 dims = text-embedding-3-small)
  relevance_embedding   vector(1536),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.past_performance is
  'FAR 15.305 past-performance records. Team-scoped; user_id is audit trail. scope_narrative is evergreen — LLM tailors per-proposal at draft time.';

-- Indexes for the relevance ranker's signals
create index if not exists idx_pp_user_id on public.past_performance (user_id);
create index if not exists idx_pp_team_id on public.past_performance (team_id);
create index if not exists idx_pp_naics on public.past_performance using gin (naics_codes);
create index if not exists idx_pp_set_asides on public.past_performance using gin (set_asides_claimed);
create index if not exists idx_pp_tags on public.past_performance using gin (tags);
-- pgvector IVFFlat index: skip until ~100 rows exist; sequential scan is faster below that

-- ============================================================
-- SECURITY DEFINER helper — lists team_ids the caller belongs to.
-- Bypasses RLS on team_members to prevent recursion when used inside
-- past_performance policies. search_path='' locks down privilege escalation.
-- ============================================================
create or replace function public.pp_user_team_ids()
returns uuid[]
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(array_agg(team_id), '{}'::uuid[])
  from public.team_members
  where user_id = auth.uid();
$$;

comment on function public.pp_user_team_ids() is
  'Returns team_ids the current auth user is a member of. SECURITY DEFINER to bypass RLS on team_members and avoid recursion from past_performance policies.';

-- ============================================================
-- RLS
-- ============================================================
alter table public.past_performance enable row level security;

-- Solo: user reads + writes their own unassigned rows
drop policy if exists "pp: solo owner read" on public.past_performance;
create policy "pp: solo owner read"
  on public.past_performance for select to authenticated
  using (team_id is null and user_id = auth.uid());

drop policy if exists "pp: solo owner write" on public.past_performance;
create policy "pp: solo owner write"
  on public.past_performance for all to authenticated
  using (team_id is null and user_id = auth.uid())
  with check (team_id is null and user_id = auth.uid());

-- Team: all members can read + write team-scoped rows
drop policy if exists "pp: team member read" on public.past_performance;
create policy "pp: team member read"
  on public.past_performance for select to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()));

drop policy if exists "pp: team member write" on public.past_performance;
create policy "pp: team member write"
  on public.past_performance for all to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()))
  with check (team_id is not null and team_id = any(public.pp_user_team_ids()));

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.pp_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pp_touch_updated_at on public.past_performance;
create trigger trg_pp_touch_updated_at
  before update on public.past_performance
  for each row execute function public.pp_touch_updated_at();
