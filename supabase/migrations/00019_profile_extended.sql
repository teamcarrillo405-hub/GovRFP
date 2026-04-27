-- Extend profiles table with business capacity, construction types,
-- geography, SAM.gov registration, and onboarding flag.
-- All columns use ADD COLUMN IF NOT EXISTS for safe re-runs.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_revenue_usd     bigint,
  ADD COLUMN IF NOT EXISTS bonding_single_usd     bigint,
  ADD COLUMN IF NOT EXISTS bonding_aggregate_usd  bigint,
  ADD COLUMN IF NOT EXISTS surety_company         text,
  ADD COLUMN IF NOT EXISTS max_project_size_usd   bigint,
  ADD COLUMN IF NOT EXISTS employee_count         integer,
  ADD COLUMN IF NOT EXISTS years_in_business      integer,
  ADD COLUMN IF NOT EXISTS sam_gov_registered     boolean not null default false,
  ADD COLUMN IF NOT EXISTS construction_types     text[]  not null default '{}',
  ADD COLUMN IF NOT EXISTS sba_size_category      text
    CHECK (sba_size_category IS NULL OR sba_size_category IN ('small', 'other_than_small')),
  ADD COLUMN IF NOT EXISTS primary_state          text,
  ADD COLUMN IF NOT EXISTS geographic_states      text[]  not null default '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed   boolean not null default false;
