-- Picture Find Phase 3: family shared puzzles + attempts/leaderboard
begin;

create table if not exists public.picture_find_puzzles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  scene_id uuid not null references public.picture_find_scenes(id) on delete cascade,
  mode text not null check (mode in ('hidden', 'spot_diff')),
  seed text not null,
  title text not null,
  item_count integer not null check (item_count >= 5 and item_count <= 10),
  published_by uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_picture_find_puzzles_group_active
  on public.picture_find_puzzles (group_id, is_active, created_at desc);

create table if not exists public.picture_find_attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.picture_find_puzzles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  found_count integer not null check (found_count >= 0),
  total_count integer not null check (total_count >= 1),
  remaining_ms integer not null check (remaining_ms >= 0),
  hints_used integer not null default 0 check (hints_used >= 0 and hints_used <= 3),
  timed_out boolean not null default false,
  completed boolean not null default false,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (puzzle_id, user_id)
);

create index if not exists idx_picture_find_attempts_puzzle
  on public.picture_find_attempts (puzzle_id, completed desc, elapsed_ms asc, hints_used asc);

create index if not exists idx_picture_find_attempts_group_user
  on public.picture_find_attempts (group_id, user_id, created_at desc);

create or replace function public.update_picture_find_puzzles_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_picture_find_puzzles_updated_at on public.picture_find_puzzles;
create trigger trg_picture_find_puzzles_updated_at
before update on public.picture_find_puzzles
for each row
execute function public.update_picture_find_puzzles_updated_at();

create or replace function public.update_picture_find_attempts_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_picture_find_attempts_updated_at on public.picture_find_attempts;
create trigger trg_picture_find_attempts_updated_at
before update on public.picture_find_attempts
for each row
execute function public.update_picture_find_attempts_updated_at();

alter table public.picture_find_puzzles enable row level security;
alter table public.picture_find_attempts enable row level security;

drop policy if exists "picture_find_puzzles_select_member" on public.picture_find_puzzles;
create policy "picture_find_puzzles_select_member"
on public.picture_find_puzzles
for select
to authenticated
using (
  is_active = true
  and public.is_family_game_group_member(group_id)
);

drop policy if exists "picture_find_puzzles_insert_member" on public.picture_find_puzzles;
create policy "picture_find_puzzles_insert_member"
on public.picture_find_puzzles
for insert
to authenticated
with check (
  published_by = auth.uid()
  and public.is_family_game_group_member(group_id)
);

drop policy if exists "picture_find_puzzles_update_manage" on public.picture_find_puzzles;
create policy "picture_find_puzzles_update_manage"
on public.picture_find_puzzles
for update
to authenticated
using (
  public.is_family_game_group_member(group_id)
  and (
    published_by = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.group_id = picture_find_puzzles.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = picture_find_puzzles.group_id
        and g.owner_id = auth.uid()
    )
  )
)
with check (public.is_family_game_group_member(group_id));

drop policy if exists "picture_find_attempts_select_member" on public.picture_find_attempts;
create policy "picture_find_attempts_select_member"
on public.picture_find_attempts
for select
to authenticated
using (public.is_family_game_group_member(group_id));

drop policy if exists "picture_find_attempts_insert_own" on public.picture_find_attempts;
create policy "picture_find_attempts_insert_own"
on public.picture_find_attempts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_family_game_group_member(group_id)
);

drop policy if exists "picture_find_attempts_update_own" on public.picture_find_attempts;
create policy "picture_find_attempts_update_own"
on public.picture_find_attempts
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_family_game_group_member(group_id)
)
with check (
  user_id = auth.uid()
  and public.is_family_game_group_member(group_id)
);

commit;
