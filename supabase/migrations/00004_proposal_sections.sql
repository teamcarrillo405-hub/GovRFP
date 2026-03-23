-- Phase 4: Proposal section drafts storage
create table public.proposal_sections (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  section_name    text not null
    check (section_name in (
      'Executive Summary',
      'Technical Approach',
      'Management Plan',
      'Past Performance',
      'Price Narrative'
    )),
  content         jsonb not null default '{"type":"doc","content":[]}',
  draft_status    text not null default 'empty'
    check (draft_status in ('empty', 'generating', 'draft', 'edited')),
  last_saved_at   timestamptz,
  tokens_used     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (proposal_id, section_name)
);

alter table public.proposal_sections enable row level security;

create policy "Users can manage own proposal_sections"
  on proposal_sections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index idx_proposal_sections_proposal on proposal_sections (proposal_id);
create index idx_proposal_sections_user on proposal_sections (user_id);

-- Auto-update updated_at on modification
create trigger set_proposal_sections_updated_at
  before update on proposal_sections
  for each row execute function update_updated_at();
