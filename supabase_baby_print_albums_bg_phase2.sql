-- Phase 2 print album backgrounds: premium 8 + cute 8

begin;

alter table public.baby_print_albums
  drop constraint if exists baby_print_albums_bg_check;

alter table public.baby_print_albums
  add constraint baby_print_albums_bg_check
  check (bg in (
    'cream', 'blush', 'sage', 'sky', 'wash', 'line', 'floral', 'vellum',
    'stars_clouds', 'hearts_soft', 'moon', 'animals', 'rainbow', 'balloons', 'footprints', 'blocks'
  ));

commit;
