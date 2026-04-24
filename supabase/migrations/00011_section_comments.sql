-- Sprint 4: Section comment threads for team review workflow.
-- Each comment is scoped to a proposal + section_name.
-- Resolved comments are soft-flagged (not deleted) so history is preserved.

create table if not exists public.section_comments (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals(id) on delete cascade,
  section_name  text not null,
  user_id       uuid not null,
  author_email  text not null,
  body          text not null
    check (char_length(body) > 0 and char_length(body) <= 2000),
  resolved      boolean not null default false,
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_section_comments_proposal_section
  on public.section_comments(proposal_id, section_name, created_at);

alter table public.section_comments enable row level security;

-- Owner (solo) or any team member can read
create policy "section_comments: read"
  on public.section_comments for select to authenticated
  using (
    exists (
      select 1 from public.proposals p where p.id = proposal_id
      and (
        (p.team_id is null and p.user_id = auth.uid())
        or (p.team_id is not null and p.team_id = any(public.pp_user_team_ids()))
      )
    )
  );

-- Owner or team member can insert (user_id must equal caller)
create policy "section_comments: insert"
  on public.section_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.proposals p where p.id = proposal_id
      and (
        (p.team_id is null and p.user_id = auth.uid())
        or (p.team_id is not null and p.team_id = any(public.pp_user_team_ids()))
      )
    )
  );

-- Any proposal member can resolve (update) a comment
create policy "section_comments: update (resolve)"
  on public.section_comments for update to authenticated
  using (
    exists (
      select 1 from public.proposals p where p.id = proposal_id
      and (
        (p.team_id is null and p.user_id = auth.uid())
        or (p.team_id is not null and p.team_id = any(public.pp_user_team_ids()))
      )
    )
  );

-- Only the comment author can delete their own comments
create policy "section_comments: delete own"
  on public.section_comments for delete to authenticated
  using (user_id = auth.uid());
