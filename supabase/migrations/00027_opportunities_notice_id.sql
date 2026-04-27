-- Add notice_id as a full unique column for SAM.gov upsert deduplication.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS notice_id text;

-- Drop the partial index if it was already created, replace with full constraint
DROP INDEX IF EXISTS idx_opportunities_notice_id;

-- Add unique constraint (required for ON CONFLICT to work in upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunities_notice_id_key'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_notice_id_key UNIQUE (notice_id);
  END IF;
END
$$;
