-- Add source_proposal_id to past_performance so PP records auto-created
-- from a Won proposal can be traced back (and deduped on re-save).
ALTER TABLE public.past_performance
  ADD COLUMN IF NOT EXISTS source_proposal_id uuid
    REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_source_proposal
  ON public.past_performance (source_proposal_id)
  WHERE source_proposal_id IS NOT NULL;
