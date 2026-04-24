-- =============================================================================
-- Phase 13: Red Team Simulation — AI evaluates proposal as federal SSEB panel
-- =============================================================================

CREATE TABLE IF NOT EXISTS red_team_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz DEFAULT now(),
  overall_score    integer CHECK (overall_score BETWEEN 0 AND 100),
  overall_verdict  text CHECK (overall_verdict IN ('outstanding','good','acceptable','marginal','unacceptable')),
  criteria_scores  jsonb NOT NULL DEFAULT '[]',
  -- Array of: { criterion, weight, score, verdict, strengths[], weaknesses[], risks[], recommended_edits[] }
  summary          text,
  evaluator_notes  text
);

CREATE INDEX IF NOT EXISTS red_team_results_proposal_id_idx ON red_team_results(proposal_id);

-- RLS: users can only see their own red team results
ALTER TABLE red_team_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own red_team_results"
  ON red_team_results FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own red_team_results"
  ON red_team_results FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
