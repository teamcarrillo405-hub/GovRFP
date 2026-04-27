-- source_id was a GovRFP-internal column that ended up NOT NULL.
-- ProposalAI's own opportunity seeds don't have a source_id.
-- Make it nullable so the sync route and seed script can insert rows.

ALTER TABLE public.opportunities
  ALTER COLUMN source_id DROP NOT NULL;
