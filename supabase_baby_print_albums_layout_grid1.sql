-- 인쇄 앨범 배치: 1열(grid1) 허용
alter table public.baby_print_albums
  drop constraint if exists baby_print_albums_layout_check;

alter table public.baby_print_albums
  add constraint baby_print_albums_layout_check
  check (layout in ('grid1', 'grid2', 'grid3', 'hero'));
