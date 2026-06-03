-- Travel diary entries (per trip / per place)
begin;

create table if not exists public.travel_diary_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  source_kind text check (
    source_kind is null
    or source_kind in ('attraction', 'dining', 'accommodation', 'transport', 'itinerary')
  ),
  source_id uuid,
  day_date date not null,
  note text,
  mood_tags jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_travel_diary_entries_trip
  on public.travel_diary_entries (trip_id, day_date, sort_order)
  where deleted_at is null;

create index if not exists idx_travel_diary_entries_group
  on public.travel_diary_entries (group_id)
  where deleted_at is null;

create unique index if not exists uq_travel_diary_entries_place
  on public.travel_diary_entries (group_id, trip_id, source_kind, source_id)
  where deleted_at is null and source_kind is not null and source_id is not null;

alter table public.travel_diary_entries enable row level security;

drop policy if exists "travel_diary_entries_select" on public.travel_diary_entries;
create policy "travel_diary_entries_select" on public.travel_diary_entries
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_diary_entries_insert" on public.travel_diary_entries;
create policy "travel_diary_entries_insert" on public.travel_diary_entries
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_diary_entries_update" on public.travel_diary_entries;
create policy "travel_diary_entries_update" on public.travel_diary_entries
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_diary_entries_delete" on public.travel_diary_entries;
create policy "travel_diary_entries_delete" on public.travel_diary_entries
  for delete using (public.is_group_member(group_id, auth.uid()));

comment on table public.travel_diary_entries is 'Travel diary timeline entries (photos via feature_attachments)';

commit;
