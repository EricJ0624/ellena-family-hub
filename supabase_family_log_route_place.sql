-- Optional location pin on route-recorded family log cards.
-- Route start stays in latitude/longitude. Check-in cards do not use these columns.

alter table public.family_log_cards
  add column if not exists place_latitude double precision,
  add column if not exists place_longitude double precision;

comment on column public.family_log_cards.place_latitude is
  'Optional pin on a route card. Separate from route start latitude.';
comment on column public.family_log_cards.place_longitude is
  'Optional pin on a route card. Separate from route start longitude.';
