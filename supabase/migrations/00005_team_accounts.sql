-- Phase 7: Team accounts and RBAC
-- Creates teams, team_members, team_invites tables with dual RLS on proposals and proposal_sections
-- Per decisions: D-01, D-02, D-03, D-04, D-11, D-12

-- =============================================================================
-- Section 1: teams table (owner policy only — member-view policy added after function)
-- =============================================================================
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  seat_count  integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.teams enable row level security;

create policy "Owner can manage their team"
  on teams for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- =============================================================================
-- Section 2: team_members table (no policies yet — function comes first)
-- =============================================================================
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'viewer'
    check (role in ('owner', 'editor', 'viewer')),
  joined_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.team_members enable row level security;

-- =============================================================================
-- Section 3: SECURITY DEFINER helper (team_members now exists)
-- Prevents RLS recursion when policies on other tables reference team_members
-- =============================================================================
create or replace function public.get_team_ids_for_user(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from team_members where user_id = p_user_id
$$;

-- =============================================================================
-- Section 4: team_members RLS policies (use the function)
-- =============================================================================
create policy "Team members can view own team roster"
  on team_members for select to authenticated
  using (team_id in (select get_team_ids_for_user((select auth.uid()))));

create policy "Owner can manage team membership"
  on team_members for all to authenticated
  using (team_id in (select id from teams where owner_id = (select auth.uid())))
  with check (team_id in (select id from teams where owner_id = (select auth.uid())));

-- =============================================================================
-- Section 5: teams member-view policy (uses the function)
-- =============================================================================
create policy "Team members can view their team"
  on teams for select to authenticated
  using (id in (select get_team_ids_for_user((select auth.uid()))));

-- =============================================================================
-- Section 6: team_invites table + policies
-- =============================================================================
create table public.team_invites (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams on delete cascade,
  invited_by      uuid not null references auth.users on delete cascade,
  invitee_email   text not null,
  role            text not null default 'viewer'
    check (role in ('editor', 'viewer')),
  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (team_id, invitee_email)
);

alter table public.team_invites enable row level security;

create policy "Owner can manage team invites"
  on team_invites for all to authenticated
  using (team_id in (select id from teams where owner_id = (select auth.uid())))
  with check (team_id in (select id from teams where owner_id = (select auth.uid())));

create policy "Invitees can view their own pending invites"
  on team_invites for select to authenticated
  using (
    invitee_email = (select email from auth.users where id = (select auth.uid()))
  );

-- =============================================================================
-- Section 7: proposals.team_id FK (D-01, D-04)
-- Nullable FK — proposals remain solo until explicitly assigned to a team
-- on delete set null — if team is deleted, proposal is not orphaned
-- =============================================================================
alter table public.proposals
  add column team_id uuid references public.teams on delete set null;

create index on proposals (team_id);

create policy "Team members can access team proposals"
  on proposals for all to authenticated
  using (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  )
  with check (
    team_id is not null
    and team_id in (select get_team_ids_for_user((select auth.uid())))
  );

-- =============================================================================
-- Section 8: proposal_sections dual RLS (critical gap — D-03)
-- Team members access sections via proposal team membership
-- =============================================================================
create policy "Team members can access team proposal_sections"
  on proposal_sections for all to authenticated
  using (
    proposal_id in (
      select id from proposals
      where team_id is not null
        and team_id in (select get_team_ids_for_user((select auth.uid())))
    )
  )
  with check (
    proposal_id in (
      select id from proposals
      where team_id is not null
        and team_id in (select get_team_ids_for_user((select auth.uid())))
    )
  );

-- =============================================================================
-- Section 9: Performance indexes
-- =============================================================================
create index on team_members (user_id);
create index on team_members (team_id);
create index on team_invites (team_id);
create index on team_invites (invitee_email);
