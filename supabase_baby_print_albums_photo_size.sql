-- 인쇄용 앨범 출력 사진 규격
alter table public.baby_print_albums
  add column if not exists photo_size text not null default 'std_4x6';

comment on column public.baby_print_albums.photo_size is
  'Print photo size: mini_2x3 | small_3_5x5 | std_4x6 | large_5x7 | xl_8x10';
