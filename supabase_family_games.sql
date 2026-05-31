-- Family Games: multiplayer sessions (ladder, RPS, roulette)
-- Group-scoped; one active session per group; RPS secrets isolated by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.family_game_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  game_type text not null check (game_type in ('ladder', 'rps', 'roulette')),
  status text not null default 'config' check (
    status in ('config', 'active', 'revealing', 'completed', 'cancelled')
  ),
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null default 'config',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create table if not exists public.family_game_participants (
  session_id uuid not null references public.family_game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_index int not null default 0,
  ready boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- RPS hidden choices: only owner may read/write (column-level isolation via separate table)
create table if not exists public.family_game_participant_secrets (
  session_id uuid not null references public.family_game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  secret jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists idx_family_game_sessions_group
  on public.family_game_sessions (group_id);

create index if not exists idx_family_game_sessions_group_status
  on public.family_game_sessions (group_id, status);

create index if not exists idx_family_game_participants_session
  on public.family_game_participants (session_id);

-- One non-terminal session per group
create unique index if not exists family_game_sessions_one_active_per_group
  on public.family_game_sessions (group_id)
  where status not in ('completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- RLS helper: group member or owner
-- ---------------------------------------------------------------------------

create or replace function public.is_family_game_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  )
  or exists (
    select 1 from groups g
    where g.id = p_group_id and g.owner_id = auth.uid()
  );
$$;

create or replace function public.is_family_game_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from family_game_sessions s
    where s.id = p_session_id
      and public.is_family_game_group_member(s.group_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table public.family_game_sessions enable row level security;
alter table public.family_game_participants enable row level security;
alter table public.family_game_participant_secrets enable row level security;

-- Sessions: group members read only (writes via service role API)
drop policy if exists "family_game_sessions_select_member" on public.family_game_sessions;
create policy "family_game_sessions_select_member" on public.family_game_sessions
  for select
  using (public.is_family_game_group_member(group_id));

-- Participants: group members read; owner may update own payload/ready
drop policy if exists "family_game_participants_select_member" on public.family_game_participants;
create policy "family_game_participants_select_member" on public.family_game_participants
  for select
  using (public.is_family_game_session_member(session_id));

drop policy if exists "family_game_participants_update_own" on public.family_game_participants;
create policy "family_game_participants_update_own" on public.family_game_participants
  for update
  using (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  );

-- Secrets: owner only (RPS choices hidden from other clients)
drop policy if exists "family_game_secrets_select_own" on public.family_game_participant_secrets;
create policy "family_game_secrets_select_own" on public.family_game_participant_secrets
  for select
  using (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  );

drop policy if exists "family_game_secrets_insert_own" on public.family_game_participant_secrets;
create policy "family_game_secrets_insert_own" on public.family_game_participant_secrets
  for insert
  with check (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  );

drop policy if exists "family_game_secrets_update_own" on public.family_game_participant_secrets;
create policy "family_game_secrets_update_own" on public.family_game_participant_secrets
  for update
  using (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_family_game_session_member(session_id)
  );

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_game_sessions'
  ) then
    alter publication supabase_realtime add table public.family_game_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_game_participants'
  ) then
    alter publication supabase_realtime add table public.family_game_participants;
  end if;
end $$;

alter table public.family_game_sessions replica identity full;
alter table public.family_game_participants replica identity full;
