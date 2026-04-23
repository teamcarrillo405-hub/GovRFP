-- ============================================================
-- Phase 09: Quality Watchdog + Technical Watchdog
--
-- Quality Watchdog: after each section draft, Claude scores the
-- content against the RFP's Section L/M evaluation criteria. If the
-- score is below 90/100 the system auto-redrafts with the critique
-- as additional context (max 3 attempts). The final approved draft
-- and its score are stored here.
--
-- Technical Watchdog: pg_cron + Edge Function runs every 5 minutes
-- to detect and recover stuck processes. Events are logged here.
-- ============================================================

-- ============================================================
-- section_scores: one row per draft attempt per section
-- ============================================================
create table if not exists public.section_scores (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  section_name    text not null,
  attempt         int  not null default 1,   -- 1, 2, or 3
  score           int  not null,             -- 0-100 weighted composite
  passed          boolean not null,          -- score >= 90
  criteria_scores jsonb not null default '{}',  -- per-criterion breakdown
  critique        text not null default '',  -- what needs improvement
  gaps            jsonb not null default '[]',  -- string[] of gap areas
  content_hash    text,                      -- SHA-1 of draft content scored
  created_at      timestamptz not null default now()
);

create index if not exists idx_section_scores_proposal
  on public.section_scores(proposal_id, section_name, attempt);

-- ============================================================
-- Extend proposal_sections: scoring columns
-- ============================================================
alter table public.proposal_sections
  add column if not exists scoring_status text
    check (scoring_status in ('pending','scoring','approved','failed'))
    default 'pending',
  add column if not exists score_value int,
  add column if not exists score_pass boolean,
  add column if not exists draft_attempt int not null default 1;

-- ============================================================
-- watchdog_events: technical watchdog recovery log
-- ============================================================
create table if not exists public.watchdog_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,  -- 'stuck_proposal'|'stuck_section'|'stuck_question_session'
  entity_table  text not null,
  entity_id     uuid not null,
  stuck_status  text not null,  -- the status that was stuck
  stuck_minutes numeric not null,
  action_taken  text not null,  -- what the watchdog did
  resolved      boolean not null default true,
  error_detail  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_watchdog_events_created
  on public.watchdog_events(created_at desc);

-- ============================================================
-- RLS: section_scores (same owner/team pattern as question_sessions)
-- ============================================================
alter table public.section_scores enable row level security;

create policy "section_scores: owner or team member read"
  on public.section_scores
  for select
  to authenticated
  using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and (
          (p.team_id is null and p.user_id = auth.uid())
          or (p.team_id is not null and p.team_id = any(public.pp_user_team_ids()))
        )
    )
  );

create policy "section_scores: owner or team member insert"
  on public.section_scores
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and (
          (p.team_id is null and p.user_id = auth.uid())
          or (p.team_id is not null and p.team_id = any(public.pp_user_team_ids()))
        )
    )
  );

-- watchdog_events: service-role only (Edge Function writes, UI reads via admin)
alter table public.watchdog_events enable row level security;

create policy "watchdog_events: admin read"
  on public.watchdog_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );
