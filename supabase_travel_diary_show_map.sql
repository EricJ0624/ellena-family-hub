-- Diary card: whether to show the place map snippet.
-- Existing RLS on travel_diary_entries is unchanged.

alter table public.travel_diary_entries
  add column if not exists show_map boolean not null default true;

comment on column public.travel_diary_entries.show_map is
  'When true, diary card may show the place map snippet. Toggle in diary edit; does not change planner place data.';
