-- Phase 18: Color Team review status tracking (Shipley methodology)
alter table public.proposal_sections
  add column if not exists color_team_status text
    not null default 'white'
    check (color_team_status in ('white','pink','red','gold','final'));

alter table public.proposal_sections
  add column if not exists color_team_updated_at timestamptz;

alter table public.proposal_sections
  add column if not exists color_team_notes text;
