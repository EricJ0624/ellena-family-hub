-- Diary card collage: which 6 photos show, and film vs postal layout.
-- Existing RLS on travel_diary_entries is unchanged.

begin;

alter table public.travel_diary_entries
  add column if not exists collage_attachment_ids jsonb,
  add column if not exists collage_style text not null default 'film';

alter table public.travel_diary_entries
  drop constraint if exists travel_diary_entries_collage_style_check;

alter table public.travel_diary_entries
  add constraint travel_diary_entries_collage_style_check
  check (collage_style in ('film', 'postal'));

comment on column public.travel_diary_entries.collage_attachment_ids is
  'Up to 6 attachment ids shown on the diary card. null = default first photos.';
comment on column public.travel_diary_entries.collage_style is
  'Card photo layout: film strip or postal album.';

commit;
