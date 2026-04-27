-- Content library: reusable text snippets saved from the proposal editor
-- or created directly. Supports tagging, keyword search, and usage tracking.

CREATE TABLE IF NOT EXISTS public.content_snippets (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id       uuid    REFERENCES public.teams(id) ON DELETE SET NULL,
  -- Content
  title         text    NOT NULL,
  body          text    NOT NULL,
  category      text    NOT NULL DEFAULT 'general'
    CHECK (category IN ('past_performance', 'technical', 'management', 'qualifications', 'price', 'boilerplate', 'general')),
  -- Discovery
  tags          text[]  NOT NULL DEFAULT '{}',
  naics_codes   text[]  NOT NULL DEFAULT '{}',
  -- Quality signal
  quality_score integer CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  -- Usage counter incremented each time snippet is inserted into a proposal
  use_count     integer NOT NULL DEFAULT 0,
  -- Source traceability
  source_proposal_id  uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  source_section_name text,
  -- Metadata
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snippets"
  ON content_snippets FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Team members can read team snippets"
  ON content_snippets FOR SELECT TO authenticated
  USING (
    team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = content_snippets.team_id
        AND tm.user_id = (SELECT auth.uid())
    )
  );

-- Full-text search index for keyword search
CREATE INDEX IF NOT EXISTS idx_content_snippets_fts
  ON content_snippets USING gin(to_tsvector('english', title || ' ' || body));

CREATE INDEX IF NOT EXISTS idx_content_snippets_user
  ON content_snippets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_snippets_team
  ON content_snippets (team_id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_snippets_category
  ON content_snippets (user_id, category);
