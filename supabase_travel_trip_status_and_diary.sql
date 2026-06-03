-- Trip status / diary_enabled for travel diary integration
-- Run in Supabase SQL Editor after confirming travel_trips exists.

begin;

alter table public.travel_trips
  add column if not exists status text not null default 'planning';

alter table public.travel_trips
  add column if not exists status_source text not null default 'auto';

alter table public.travel_trips
  add column if not exists diary_enabled boolean not null default false;

alter table public.travel_trips
  drop constraint if exists travel_trips_status_check;

alter table public.travel_trips
  add constraint travel_trips_status_check
  check (status in ('planning', 'active', 'completed'));

alter table public.travel_trips
  drop constraint if exists travel_trips_status_source_check;

alter table public.travel_trips
  add constraint travel_trips_status_source_check
  check (status_source in ('auto', 'manual'));

comment on column public.travel_trips.status is 'planning | active | completed';
comment on column public.travel_trips.status_source is 'auto: date-driven status; manual: user override, auto does not overwrite';
comment on column public.travel_trips.diary_enabled is 'User opted in to write diary while planning';

-- Backfill status from dates for existing rows (local calendar semantics via date columns)
update public.travel_trips t
set status = case
  when current_date < t.start_date then 'planning'
  when current_date > t.end_date then 'completed'
  else 'active'
end
where t.deleted_at is null
  and t.status_source = 'auto';

commit;
