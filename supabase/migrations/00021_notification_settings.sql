create table if not exists notification_settings (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  slack_webhook_url  text,
  teams_webhook_url  text,
  notify_task_assign boolean not null default true,
  notify_deadline    boolean not null default true,
  notify_status      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(proposal_id, user_id)
);

alter table notification_settings enable row level security;

create policy "Users manage own notification settings"
  on notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
