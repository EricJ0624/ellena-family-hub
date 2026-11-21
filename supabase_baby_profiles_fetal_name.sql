-- 태명 (prenatal/birth → 육아 write-through 대비)
alter table public.baby_profiles
  add column if not exists fetal_name text;

comment on column public.baby_profiles.fetal_name is '태명 — prenatal/birth에서 전달 가능';
