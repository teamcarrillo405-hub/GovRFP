-- ============================================================
-- Phase 08: Question Engine
--
-- Active question sessions for each proposal. After RFP analysis
-- completes, the system generates 15-30 questions (templated bank +
-- Claude-generated, per locked design decision: hybrid). User answers
-- guide the LLM-drafted sections.
--
-- One in-progress session per proposal at a time. Multiple sessions
-- allowed historically (re-runs after RFP amendment, etc.).
-- ============================================================

create table if not exists public.question_sessions (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  team_id         uuid references public.teams on delete set null,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'complete', 'abandoned')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.question_sessions is
  'A session of contract-specific questions for a single proposal. Templated + LLM-generated questions persisted as question_session_items.';

create index if not exists idx_qs_proposal on public.question_sessions (proposal_id);
create index if not exists idx_qs_user on public.question_sessions (user_id);
create index if not exists idx_qs_team on public.question_sessions (team_id);

create table if not exists public.question_session_items (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.question_sessions on delete cascade,
  position        integer not null,                 -- ordering within session
  source          text not null check (source in ('template', 'generative')),
  template_key    text,                             -- e.g. "construction.scope.start_date" — null for generative
  category        text not null,                    -- past_performance | cost | schedule | compliance | differentiation | risk | scope | personnel
  question        text not null check (length(question) between 1 and 1000),
  context         text,                             -- why this question matters / hint
  required        boolean not null default false,
  answer          text,                             -- user's response (markdown allowed)
  answered_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.question_session_items is
  'Individual questions in a session. Templated items have template_key set; generative items have it null.';

create index if not exists idx_qsi_session on public.question_session_items (session_id, position);
create index if not exists idx_qsi_category on public.question_session_items (session_id, category);

-- ── RLS ──
alter table public.question_sessions enable row level security;
alter table public.question_session_items enable row level security;

-- Sessions: solo + team (reuse pp_user_team_ids helper from migration 00006)
drop policy if exists "qs: solo owner read" on public.question_sessions;
create policy "qs: solo owner read"
  on public.question_sessions for select to authenticated
  using (team_id is null and user_id = auth.uid());

drop policy if exists "qs: solo owner write" on public.question_sessions;
create policy "qs: solo owner write"
  on public.question_sessions for all to authenticated
  using (team_id is null and user_id = auth.uid())
  with check (team_id is null and user_id = auth.uid());

drop policy if exists "qs: team member read" on public.question_sessions;
create policy "qs: team member read"
  on public.question_sessions for select to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()));

drop policy if exists "qs: team member write" on public.question_sessions;
create policy "qs: team member write"
  on public.question_sessions for all to authenticated
  using (team_id is not null and team_id = any(public.pp_user_team_ids()))
  with check (team_id is not null and team_id = any(public.pp_user_team_ids()));

-- Items: inherit access from parent session via subquery
drop policy if exists "qsi: read via session" on public.question_session_items;
create policy "qsi: read via session"
  on public.question_session_items for select to authenticated
  using (
    exists (
      select 1 from public.question_sessions s
      where s.id = session_id
        and (
          (s.team_id is null and s.user_id = auth.uid())
          or (s.team_id is not null and s.team_id = any(public.pp_user_team_ids()))
        )
    )
  );

drop policy if exists "qsi: write via session" on public.question_session_items;
create policy "qsi: write via session"
  on public.question_session_items for all to authenticated
  using (
    exists (
      select 1 from public.question_sessions s
      where s.id = session_id
        and (
          (s.team_id is null and s.user_id = auth.uid())
          or (s.team_id is not null and s.team_id = any(public.pp_user_team_ids()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.question_sessions s
      where s.id = session_id
        and (
          (s.team_id is null and s.user_id = auth.uid())
          or (s.team_id is not null and s.team_id = any(public.pp_user_team_ids()))
        )
    )
  );

-- updated_at trigger on sessions
drop trigger if exists trg_qs_touch_updated_at on public.question_sessions;
create trigger trg_qs_touch_updated_at
  before update on public.question_sessions
  for each row execute function public.pp_touch_updated_at();
