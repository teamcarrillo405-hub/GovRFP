-- Proposal section snapshot history.
-- One row per section per snapshot; rows sharing the same snapshot_at+label
-- form a logical snapshot group.

CREATE TABLE IF NOT EXISTS public.section_versions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid        NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  section_name  text        NOT NULL,
  content       text,
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  label         text,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.section_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read section_versions"
  ON section_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = section_versions.proposal_id
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

CREATE POLICY "Team editors can insert section_versions"
  ON section_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = section_versions.proposal_id
        AND (
          p.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE t.id = p.team_id AND tm.user_id = (SELECT auth.uid())
              AND tm.role IN ('owner', 'editor')
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_section_versions_proposal
  ON section_versions (proposal_id, snapshot_at DESC);
