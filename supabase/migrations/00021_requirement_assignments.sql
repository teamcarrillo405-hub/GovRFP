-- Tracks which team member owns which RFP requirement section within a proposal.
-- Unique on (proposal_id, requirement_id) so one upsert sets/updates ownership.

CREATE TABLE IF NOT EXISTS public.requirement_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  requirement_id  text NOT NULL,
  assignee_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'complete')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, requirement_id)
);

ALTER TABLE public.requirement_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage requirement_assignments"
  ON requirement_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = requirement_assignments.proposal_id
        AND (
          p.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE t.id = p.team_id AND tm.user_id = (SELECT auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = requirement_assignments.proposal_id
        AND (
          p.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE t.id = p.team_id AND tm.user_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_req_assignments_proposal
  ON requirement_assignments (proposal_id);
