-- Teaming partners per proposal — tracks subcontractors, JV partners,
-- consultants, and their workshare allocations with SBA certifications.

create table if not exists teaming_partners (
  id                  uuid primary key default gen_random_uuid(),
  proposal_id         uuid not null references proposals(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  partner_name        text not null,
  role                text not null default 'Subcontractor',  -- Prime, Subcontractor, Consultant, JV Partner
  workshare_pct       numeric(5,2) not null default 0,        -- 0.00 - 100.00
  naics_codes         text[] not null default '{}',
  sba_certifications  text[] not null default '{}',           -- ['8(a)', 'HUBZone', 'SDVOSB', 'WOSB', 'VOSB']
  contact_email       text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table teaming_partners enable row level security;

create policy "Users manage own teaming partners"
  on teaming_partners for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_teaming_partners_proposal
  on teaming_partners (proposal_id);
