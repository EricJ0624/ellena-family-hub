-- 일정 시각과 시간대. 비어 있으면 만든 사람 거주 국가의 오전 9시다.

alter table public.family_events
  add column if not exists event_time time null;

alter table public.family_events
  add column if not exists event_timezone text null;

comment on column public.family_events.event_time is
  'Local time of day in event_timezone. Null means 09:00.';

comment on column public.family_events.event_timezone is
  'IANA timezone for the event clock. Null means the creator residence-country default.';
