-- =============================================================================
-- Phase 3: RFP Analysis -- rfp_analysis table + job queue extension
-- =============================================================================

-- =============================================================================
-- Section A: rfp_analysis table
-- =============================================================================
create table if not exists public.rfp_analysis (
  id                    uuid primary key default gen_random_uuid(),
  proposal_id           uuid not null unique references public.proposals(id) on delete cascade,
  user_id               uuid not null references auth.users on delete cascade,
  requirements          jsonb not null default '[]',
  compliance_matrix     jsonb not null default '[]',
  win_score             integer check (win_score >= 0 and win_score <= 100),
  win_factors           jsonb,
  set_asides_detected   text[] default '{}',
  set_aside_flags       jsonb default '[]',
  section_lm_crosswalk  jsonb not null default '[]',
  has_section_l         boolean default false,
  has_section_m         boolean default false,
  analyzed_at           timestamptz not null default now(),
  model_used            text not null default 'claude-sonnet-4-6',
  tokens_input          integer,
  tokens_output         integer,
  tokens_cached         integer,
  crosswalk_note        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- =============================================================================
-- Section B: RLS
-- =============================================================================
alter table public.rfp_analysis enable row level security;

create policy "Users can view own rfp_analysis"
  on rfp_analysis for select to authenticated
  using ((select auth.uid()) = user_id);

-- =============================================================================
-- Section C: GIN indexes for JSONB querying + standard indexes
-- =============================================================================
create index if not exists rfp_analysis_requirements_gin on rfp_analysis using gin(requirements);
create index if not exists rfp_analysis_compliance_matrix_gin on rfp_analysis using gin(compliance_matrix);
create index if not exists rfp_analysis_proposal_id_idx on rfp_analysis (proposal_id);
create index if not exists rfp_analysis_user_id_idx on rfp_analysis (user_id);

-- =============================================================================
-- Section D: Extend document_jobs with job_type column
-- =============================================================================
alter table public.document_jobs
  add column if not exists job_type text not null default 'document'
    check (job_type in ('document', 'analysis'));

-- =============================================================================
-- Section E: New claim_next_job() function + backward-compat alias
-- =============================================================================
create or replace function public.claim_next_job(p_job_type text default 'document')
returns setof public.document_jobs
language plpgsql security definer as $$
begin
  return query
  update public.document_jobs
  set status = 'processing', started_at = now(), updated_at = now()
  where id = (
    select id from public.document_jobs
    where status = 'pending' and job_type = p_job_type
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

-- Backward-compat alias: Phase 2 Edge Function still calls this name
create or replace function public.claim_next_document_job()
returns setof public.document_jobs
language plpgsql security definer as $$
begin
  return query select * from public.claim_next_job('document');
end;
$$;

-- =============================================================================
-- Section F: Update proposals.status constraint to include 'analyzed'
-- =============================================================================
alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check
  check (status in ('draft', 'processing', 'ready', 'analyzed', 'failed', 'archived'));
