-- 예방접종 실기록: 병원, 제품명, 목록 밖 백신 이름
alter table public.baby_vaccinations
  add column if not exists facility_name text,
  add column if not exists product_name text,
  add column if not exists custom_label text;
