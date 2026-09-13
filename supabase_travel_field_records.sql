-- Travel field check-in + route tracks (planner/diary auto-attach)
-- Shared Supabase: one migration for all apps (family/couple/biker/camper)

begin;

-- Link optional field recording metadata on itinerary rows
alter table public.travel_itineraries
  add column if not exists field_record_kind text;

alter table public.travel_itineraries
  add column if not exists field_track_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'travel_itineraries_field_record_kind_check'
  ) then
    alter table public.travel_itineraries
      add constraint travel_itineraries_field_record_kind_check
      check (
        field_record_kind is null
        or field_record_kind in ('checkin', 'route')
      );
  end if;
end $$;

comment on column public.travel_itineraries.field_record_kind is
  'Field recording origin: checkin | route (null = manual/planned)';
comment on column public.travel_itineraries.field_track_id is
  'Optional link to travel_field_tracks when route was recorded';

create table if not exists public.travel_field_tracks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  itinerary_id uuid references public.travel_itineraries(id) on delete set null,
  status text not null default 'recording'
    check (status in ('recording', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  day_date date,
  start_time text,
  end_time text,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_travel_field_tracks_trip
  on public.travel_field_tracks (trip_id, status, started_at desc);

create index if not exists idx_travel_field_tracks_user_recording
  on public.travel_field_tracks (user_id, status)
  where status = 'recording';

create table if not exists public.travel_field_points (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.travel_field_tracks(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  seq integer not null default 0,
  recorded_at timestamptz not null default now(),
  latitude numeric not null,
  longitude numeric not null,
  accuracy numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_travel_field_points_track
  on public.travel_field_points (track_id, seq);

-- FK from itinerary.field_track_id after tracks exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'travel_itineraries_field_track_id_fkey'
  ) then
    alter table public.travel_itineraries
      add constraint travel_itineraries_field_track_id_fkey
      foreign key (field_track_id) references public.travel_field_tracks(id)
      on delete set null;
  end if;
end $$;

alter table public.travel_field_tracks enable row level security;
alter table public.travel_field_points enable row level security;

drop policy if exists "travel_field_tracks_select" on public.travel_field_tracks;
create policy "travel_field_tracks_select" on public.travel_field_tracks
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_field_tracks_insert" on public.travel_field_tracks;
create policy "travel_field_tracks_insert" on public.travel_field_tracks
  for insert with check (
    public.is_group_member(group_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists "travel_field_tracks_update" on public.travel_field_tracks;
create policy "travel_field_tracks_update" on public.travel_field_tracks
  for update using (
    public.is_group_member(group_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists "travel_field_tracks_delete" on public.travel_field_tracks;
create policy "travel_field_tracks_delete" on public.travel_field_tracks
  for delete using (
    public.is_group_member(group_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists "travel_field_points_select" on public.travel_field_points;
create policy "travel_field_points_select" on public.travel_field_points
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_field_points_insert" on public.travel_field_points;
create policy "travel_field_points_insert" on public.travel_field_points
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_field_points_update" on public.travel_field_points;
create policy "travel_field_points_update" on public.travel_field_points
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_field_points_delete" on public.travel_field_points;
create policy "travel_field_points_delete" on public.travel_field_points
  for delete using (public.is_group_member(group_id, auth.uid()));

comment on table public.travel_field_tracks is 'On-trip GPS route sessions for travel planner/diary';
comment on table public.travel_field_points is 'GPS breadcrumbs for travel_field_tracks';

commit;
