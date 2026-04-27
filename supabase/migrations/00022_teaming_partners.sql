-- Teaming partners per proposal — tracks subcontractors, JV partners,
-- and their work-share allocations.

CREATE TABLE IF NOT EXISTS public.teaming_partners (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid    NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  company_name      text    NOT NULL,
  role              text    NOT NULL DEFAULT 'subcontractor'
    CHECK (role IN ('prime', 'subcontractor', 'jv_partner', 'mentor_protege', 'other')),
  certification     text    NOT NULL DEFAULT 'none',
  work_share_pct    integer CHECK (work_share_pct IS NULL OR (work_share_pct >= 0 AND work_share_pct <= 100)),
  point_of_contact  text,
  email             text,
  notes             text,
  status            text    NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'contacted', 'agreed', 'signed', 'declined')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teaming_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage teaming_partners"
  ON teaming_partners FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = teaming_partners.proposal_id
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
      WHERE p.id = teaming_partners.proposal_id
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

CREATE INDEX IF NOT EXISTS idx_teaming_partners_proposal
  ON teaming_partners (proposal_id);
