-- supabase/migrations/00031_contracts.sql

-- ── contracts ─────────────────────────────────────────────────────────────────
create table if not exists public.contracts (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  team_id                   uuid references public.teams(id) on delete set null,
  proposal_id               uuid references public.proposals(id) on delete set null,
  title                     text not null,
  contract_number           text,
  agency                    text,
  contracting_officer_name  text,
  contracting_officer_email text,
  co_phone                  text,
  place_of_performance      text,
  naics_code                text,
  set_aside                 text,
  base_value                bigint,
  ceiling_value             bigint,
  award_date                date,
  period_start              date,
  period_end                date,
  period_end_with_options   date,
  status                    text not null default 'active'
                              check (status in ('active','expiring','expired','complete','terminated')),
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.contracts enable row level security;

create policy "contracts: owner full access"
  on public.contracts for all
  using (user_id = auth.uid());

create policy "contracts: team member read"
  on public.contracts for select
  using (
    team_id is not null and
    exists (
      select 1 from public.team_members tm
      where tm.team_id = contracts.team_id
        and tm.user_id = auth.uid()
    )
  );

-- ── contract_deliverables ─────────────────────────────────────────────────────
create table if not exists public.contract_deliverables (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  title         text not null,
  description   text,
  due_date      date,
  frequency     text check (frequency in ('oneshot','weekly','monthly','quarterly','annual')),
  status        text not null default 'pending'
                  check (status in ('pending','submitted','accepted','overdue')),
  submitted_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.contract_deliverables enable row level security;

create policy "deliverables: via contract owner"
  on public.contract_deliverables for all
  using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_deliverables.contract_id
        and c.user_id = auth.uid()
    )
  );

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

create trigger contract_deliverables_updated_at
  before update on public.contract_deliverables
  for each row execute function public.set_updated_at();
