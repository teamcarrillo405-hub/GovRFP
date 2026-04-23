-- ============================================================
-- Phase 07: Capability Statement
--
-- One row per team (or per solo user pre-team) — the contractor firm's
-- evergreen identity. Auto-populates the boilerplate ~60% of every
-- proposal: who we are, what we can do, who vouches for us.
--
-- Design decisions (locked):
--   - Team-scoped by default (mirrors PP library decision)
--   - Rich schema from day 1 (~50 fields). Heterogeneous data lives in
--     JSONB (facilities, equipment, awards, references, etc.) — easier
--     than 5+ child tables for V1.
--   - Unique constraint: one record per team_id, or one per user_id when
--     team_id IS NULL. Enforced via partial unique indexes.
--
-- "references" is a Postgres reserved word — using "vouching_contacts" for
-- third-party contact references (separate from past_performance citations).
-- ============================================================

create table if not exists public.capability_statements (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references auth.users on delete cascade,
  team_id                         uuid references public.teams on delete set null,

  -- ── Identity ──
  company_name                    text not null check (length(company_name) between 1 and 200),
  dba_name                        text,
  uei                             text,                -- SAM.gov Unique Entity ID
  cage_code                       text,
  duns_number                     text,                -- legacy, optional
  founding_year                   integer check (founding_year is null or founding_year between 1800 and 2100),

  -- ── HQ + contact ──
  hq_address                      text,
  hq_city                         text,
  hq_state                        text check (hq_state is null or length(hq_state) = 2),
  hq_zip                          text,
  primary_contact_name            text,
  primary_contact_title           text,
  primary_contact_email           text,
  primary_contact_phone           text,
  website_url                     text,

  -- ── Certifications & set-asides ──
  -- Same enum as past_performance.set_asides_claimed for ranker compatibility
  certifications                  text[] not null default '{}',
  -- { "8A": "2023-05-15", "HZC": "2024-01-10" } — for renewal tracking + recency-in-narrative
  certification_dates             jsonb not null default '{}'::jsonb,

  -- ── NAICS specialties ──
  primary_naics                   text check (primary_naics is null or primary_naics ~ '^\d{6}$'),
  naics_codes                     text[] not null default '{}',

  -- ── Capability narrative ──
  capability_narrative            text check (capability_narrative is null or length(capability_narrative) <= 5000),
  differentiators                 jsonb not null default '[]'::jsonb,

  -- ── Bonding & insurance ──
  bonding_capacity_single_usd     numeric(14, 2) check (bonding_capacity_single_usd is null or bonding_capacity_single_usd >= 0),
  bonding_capacity_aggregate_usd  numeric(14, 2) check (bonding_capacity_aggregate_usd is null or bonding_capacity_aggregate_usd >= 0),
  bonding_company                 text,
  professional_liability_usd      numeric(14, 2) check (professional_liability_usd is null or professional_liability_usd >= 0),
  general_liability_usd           numeric(14, 2) check (general_liability_usd is null or general_liability_usd >= 0),

  -- ── Financial profile ──
  employee_count_range            text check (employee_count_range is null or employee_count_range in
                                    ('1-10', '11-50', '51-100', '101-250', '251-500', '500+')),
  -- [{ "year": 2024, "revenue_usd": 2500000 }, ...] — last 3 years recommended for FAR
  annual_revenue                  jsonb not null default '[]'::jsonb,

  -- ── Geographic reach ──
  states_active                   text[] not null default '{}',
  gsa_regions                     text[] not null default '{}',

  -- ── Past award summary ──
  -- Manually entered OR auto-computed from past_performance
  total_contracts_completed       integer check (total_contracts_completed is null or total_contracts_completed >= 0),
  total_contract_value_usd        numeric(14, 2) check (total_contract_value_usd is null or total_contract_value_usd >= 0),

  -- ── Facilities ──
  -- [{ "address": "...", "sqft": 12000, "type": "office|warehouse|yard" }]
  facilities                      jsonb not null default '[]'::jsonb,

  -- ── Equipment inventory ──
  -- [{ "type": "...", "capacity": "...", "ownership": "owned|leased" }]
  equipment                       jsonb not null default '[]'::jsonb,

  -- ── Security clearances summary ──
  -- { "public_trust": 5, "secret": 3, "ts": 1, "ts_sci": 0 }
  clearance_counts                jsonb not null default '{}'::jsonb,

  -- ── Awards & recognitions ──
  -- [{ "name": "...", "year": 2024, "issuer": "..." }]
  awards                          jsonb not null default '[]'::jsonb,

  -- ── Vouching contacts (third-party references) ──
  -- [{ "name": "...", "title": "...", "org": "...", "email": "...", "phone": "...", "relationship": "..." }]
  vouching_contacts               jsonb not null default '[]'::jsonb,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

comment on table public.capability_statements is
  'One per team (or solo user). Evergreen contractor identity — auto-populates boilerplate sections of every proposal.';

-- Partial unique indexes: one row per team OR one per solo user
create unique index if not exists uniq_cap_team on public.capability_statements (team_id) where team_id is not null;
create unique index if not exists uniq_cap_solo on public.capability_statements (user_id) where team_id is null;

-- ── RLS ──
alter table public.capability_statements enable row level security;

-- Reuse the same SECURITY DEFINER team-id helper as past_performance
-- (created in migration 00006). Avoids defining a duplicate.

drop policy if exists "cap: solo owner read" on public.capability_statements;
create policy "cap: solo owner read"
  on public.capability_statements for select to authenticated
  using (team_id is null and user_id = auth.uid());

drop policy if exists "cap: solo owner write" on public.capability_statements;
create policy "cap: solo owner write"
  on public.capability_statements for all to authenticated
  using (team_id is null and user_id = auth.uid())
  with check (team_id is null and user_id = auth.uid());

drop policy if exists "cap: team member read" on public.capability_statements;
create policy "cap: team member read"
  on public.capability_statements for select to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()));

drop policy if exists "cap: team member write" on public.capability_statements;
create policy "cap: team member write"
  on public.capability_statements for all to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()))
  with check (team_id is not null and team_id = any(public.pp_user_team_ids()));

-- Reuse the pp_touch_updated_at function (migration 00006) — it's generic
drop trigger if exists trg_cap_touch_updated_at on public.capability_statements;
create trigger trg_cap_touch_updated_at
  before update on public.capability_statements
  for each row execute function public.pp_touch_updated_at();
