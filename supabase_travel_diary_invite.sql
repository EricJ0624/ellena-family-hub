-- Diary invite status for post-completion opt-in modal (phase 2)
-- Run after supabase_travel_trip_status_and_diary.sql

begin;

alter table public.travel_trips
  add column if not exists diary_invite_status text not null default 'none';

alter table public.travel_trips
  drop constraint if exists travel_trips_diary_invite_status_check;

alter table public.travel_trips
  add constraint travel_trips_diary_invite_status_check
  check (diary_invite_status in ('none', 'pending', 'accepted', 'dismissed'));

comment on column public.travel_trips.diary_invite_status is
  'none: no prompt; pending: show completion diary modal; accepted/dismissed: user answered';

-- Existing completed trips without diary: offer invite on next load
update public.travel_trips t
set diary_invite_status = 'pending'
where t.deleted_at is null
  and t.status = 'completed'
  and t.diary_enabled = false
  and t.diary_invite_status = 'none';

commit;
