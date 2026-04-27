-- SAM.gov opportunities feed.
-- Uses CREATE TABLE IF NOT EXISTS plus ADD COLUMN IF NOT EXISTS
-- so this migration is safe to run even if the table was partially created.

CREATE TABLE IF NOT EXISTS public.opportunities (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_number         text    UNIQUE,
  notice_id                   text    UNIQUE,
  title                       text    NOT NULL,
  agency                      text,
  office                      text,
  naics_code                  text,
  set_aside                   text,
  place_of_performance_state  text,
  place_of_performance_city   text,
  estimated_value             bigint,
  posted_date                 timestamptz,
  due_date                    timestamptz,
  active                      boolean NOT NULL DEFAULT true,
  sam_url                     text,
  description                 text,
  match_score                 integer CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  synced_at                   timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be missing if table was created with an earlier schema
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS active                     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS office                     text,
  ADD COLUMN IF NOT EXISTS place_of_performance_city  text,
  ADD COLUMN IF NOT EXISTS match_score                integer,
  ADD COLUMN IF NOT EXISTS sam_url                    text,
  ADD COLUMN IF NOT EXISTS description                text,
  ADD COLUMN IF NOT EXISTS synced_at                  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS due_date                   timestamptz,
  ADD COLUMN IF NOT EXISTS posted_date                timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_value            bigint,
  ADD COLUMN IF NOT EXISTS place_of_performance_state text,
  ADD COLUMN IF NOT EXISTS set_aside                  text,
  ADD COLUMN IF NOT EXISTS naics_code                 text,
  ADD COLUMN IF NOT EXISTS title                      text,
  ADD COLUMN IF NOT EXISTS agency                     text,
  ADD COLUMN IF NOT EXISTS created_at                 timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at                 timestamptz NOT NULL DEFAULT now();

-- Enable RLS if not already enabled
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies idempotently
DROP POLICY IF EXISTS "Authenticated users can read opportunities" ON opportunities;
CREATE POLICY "Authenticated users can read opportunities"
  ON opportunities FOR SELECT TO authenticated
  USING (true);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS public.opportunity_bookmarks (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

ALTER TABLE public.opportunity_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bookmarks" ON opportunity_bookmarks;
CREATE POLICY "Users manage own bookmarks"
  ON opportunity_bookmarks FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_naics
  ON opportunities (naics_code);
CREATE INDEX IF NOT EXISTS idx_opportunities_due_date_active
  ON opportunities (due_date ASC)
  WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_set_aside
  ON opportunities (set_aside);
CREATE INDEX IF NOT EXISTS idx_opportunities_state
  ON opportunities (place_of_performance_state);
CREATE INDEX IF NOT EXISTS idx_opportunities_synced
  ON opportunities (active, synced_at DESC);
