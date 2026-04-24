alter table public.proposals
  add column if not exists custom_template_sections jsonb;
