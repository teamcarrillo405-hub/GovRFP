-- Pipeline enhancements: win probability, NAICS code, and deadline tracking
-- on proposals. These power the Pipeline Board value/probability display.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS win_probability  integer
    CHECK (win_probability IS NULL OR (win_probability >= 0 AND win_probability <= 100)),
  ADD COLUMN IF NOT EXISTS naics_code       text,
  ADD COLUMN IF NOT EXISTS due_date         timestamptz,
  ADD COLUMN IF NOT EXISTS opportunity_id   uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_due_date
  ON public.proposals (due_date ASC)
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity
  ON public.proposals (opportunity_id)
  WHERE opportunity_id IS NOT NULL;
