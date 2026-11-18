-- Phase 1 print album backgrounds: premium 4 + cute 2
-- Keep existing rows valid; extend CHECK only.

begin;

alter table public.baby_print_albums
  drop constraint if exists baby_print_albums_bg_check;

alter table public.baby_print_albums
  add constraint baby_print_albums_bg_check
  check (bg in ('cream', 'blush', 'sage', 'sky', 'stars_clouds', 'hearts_soft'));

commit;
