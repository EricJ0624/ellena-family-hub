-- 출생 스냅샷 (prenatal/birth → 육아 write-through 대비). 전부 nullable, 직접 입력 가능.
-- 기존 테이블 ALTER — GRANT/RLS 변경 없음.

alter table public.baby_profiles
  add column if not exists birth_time time,
  add column if not exists birth_place text,
  add column if not exists birth_weight_kg numeric,
  add column if not exists birth_height_cm numeric,
  add column if not exists birth_head_cm numeric,
  add column if not exists gestational_weeks numeric(4,1),
  add column if not exists blood_type text,
  add column if not exists birth_source text,
  add column if not exists birth_event_id uuid;

alter table public.baby_profiles drop constraint if exists baby_profiles_blood_type_check;
alter table public.baby_profiles
  add constraint baby_profiles_blood_type_check
  check (
    blood_type is null
    or blood_type in ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')
  );

alter table public.baby_profiles drop constraint if exists baby_profiles_birth_source_check;
alter table public.baby_profiles
  add constraint baby_profiles_birth_source_check
  check (
    birth_source is null
    or birth_source in ('manual', 'birth_event')
  );

comment on column public.baby_profiles.birth_time is '출생 시각 (로컬 time)';
comment on column public.baby_profiles.birth_place is '출생 장소/병원';
comment on column public.baby_profiles.birth_weight_kg is '출생 체중 kg';
comment on column public.baby_profiles.birth_height_cm is '출생 키 cm';
comment on column public.baby_profiles.birth_head_cm is '출생 머리둘레 cm';
comment on column public.baby_profiles.gestational_weeks is '출산 시 재태주수';
comment on column public.baby_profiles.blood_type is '혈액형 A+/A-/…';
comment on column public.baby_profiles.birth_source is 'manual | birth_event (추후 prenatal 연동)';
comment on column public.baby_profiles.birth_event_id is '추후 birth 이벤트 FK 예약';
