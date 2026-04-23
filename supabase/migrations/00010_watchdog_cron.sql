-- ============================================================
-- Phase 10: pg_cron schedule for the Technical Watchdog Edge Function
--
-- Runs every 5 minutes. The Edge Function resets stuck processes
-- (analyzing proposals, generating sections, generating question
-- sessions) and logs recovery events to watchdog_events.
--
-- Prerequisites: pg_cron extension must be enabled in Supabase.
-- The watchdog Edge Function must be deployed before enabling.
-- ============================================================

-- Remove any pre-existing job with this name (idempotent)
select cron.unschedule('technical-watchdog') where exists (
  select 1 from cron.job where jobname = 'technical-watchdog'
);

-- Schedule watchdog every 5 minutes
-- The vault lookup pattern matches how existing cron jobs in this project
-- fetch the project URL and service role key (see migration 00003).
select cron.schedule(
  'technical-watchdog',
  '*/5 * * * *',
  $$
  select net.http_post(
    url        := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/watchdog',
    headers    := jsonb_build_object(
                    'Content-Type',  'application/json',
                    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
                  ),
    body       := '{}',
    timeout_milliseconds := 30000
  )
  $$
);
