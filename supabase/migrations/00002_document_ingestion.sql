-- =============================================================================
-- Phase 2: Document Ingestion -- extend proposals + create document_jobs
-- =============================================================================

-- Extend proposals table with document columns
alter table public.proposals
  add column file_name    text,
  add column file_type    text check (file_type in ('pdf', 'docx')),
  add column storage_path text,
  add column rfp_text     text,
  add column rfp_structure jsonb,
  add column page_count   integer,
  add column is_scanned   boolean default false,
  add column ocr_used     boolean default false;

-- =============================================================================
-- Document Jobs -- async processing queue
-- =============================================================================
create table public.document_jobs (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals(id) on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  storage_path  text not null,
  file_type     text not null check (file_type in ('pdf', 'docx')),
  status        text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  page_offset   integer default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.document_jobs enable row level security;

create policy "Users can view own document_jobs"
  on document_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

-- Performance indexes
create index on document_jobs (status, created_at);
create index on document_jobs (proposal_id);
create index on document_jobs (user_id);

-- =============================================================================
-- Atomic job claim function -- prevents double-processing
-- Called by Edge Function to pick next pending job with row-level locking
-- =============================================================================
create or replace function public.claim_next_document_job()
returns setof public.document_jobs
language plpgsql security definer as $$
begin
  return query
  update public.document_jobs
  set status = 'processing', started_at = now(), updated_at = now()
  where id = (
    select id from public.document_jobs
    where status = 'pending'
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;
