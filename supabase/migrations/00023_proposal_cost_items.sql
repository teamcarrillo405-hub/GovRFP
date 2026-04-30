create table if not exists proposal_cost_items (
  id               uuid primary key default gen_random_uuid(),
  proposal_id      uuid not null references proposals(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  labor_category   text not null,
  cost_type        text not null default 'direct',  -- 'direct', 'indirect', 'fee'
  rate_per_hour    numeric(10,2) not null default 0,
  hours            numeric(10,2) not null default 0,
  period_of_performance text,
  notes            text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table proposal_cost_items enable row level security;

create policy "Users manage own cost items"
  on proposal_cost_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profit/fee settings stored per proposal in a separate table
create table if not exists proposal_cost_settings (
  proposal_id      uuid primary key references proposals(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  fee_pct          numeric(5,2) not null default 10,
  overhead_rate    numeric(5,2) not null default 0,
  g_and_a_rate     numeric(5,2) not null default 0,
  updated_at       timestamptz not null default now()
);

alter table proposal_cost_settings enable row level security;

create policy "Users manage own cost settings"
  on proposal_cost_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
