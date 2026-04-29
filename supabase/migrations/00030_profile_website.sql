-- Add website URL, differentiators, and EMR to profiles
alter table public.profiles
  add column if not exists website_url text,
  add column if not exists differentiators text,
  add column if not exists emr numeric(4,2);  -- Experience Modification Rate, e.g. 0.82
