-- Legacy GovRFP columns that are NOT NULL but not used by ProposalAI.
-- Making them nullable allows ProposalAI seed data and SAM.gov sync inserts
-- to work without providing meaningless placeholder values.

ALTER TABLE public.opportunities
  ALTER COLUMN external_id     DROP NOT NULL,
  ALTER COLUMN is_active       DROP NOT NULL,
  ALTER COLUMN last_updated_at DROP NOT NULL,
  ALTER COLUMN first_seen_at   DROP NOT NULL;
