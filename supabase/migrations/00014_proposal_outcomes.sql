-- Add outcome tracking columns to proposals table
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS outcome text
    CHECK (outcome IN ('won', 'lost', 'no_bid', 'pending')),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_value numeric(15,2),
  ADD COLUMN IF NOT EXISTS outcome_notes text;
