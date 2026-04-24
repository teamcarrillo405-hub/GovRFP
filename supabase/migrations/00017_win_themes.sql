alter table public.proposals
  add column if not exists win_themes jsonb default '[]'::jsonb;
