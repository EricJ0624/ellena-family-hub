-- prenatal_logs: 병원 방문·태동·검사·복약 기록 필드 + log_type 확장
-- (기존 테이블 ALTER — GRANT 유지)

alter table public.prenatal_logs
  drop constraint if exists prenatal_logs_log_type_check;

alter table public.prenatal_logs
  add constraint prenatal_logs_log_type_check
  check (log_type = any (array[
    'maternal_weight',
    'blood_pressure',
    'symptom',
    'diary',
    'fetal_size',
    'checkup_note',
    'fetal_movement',
    'lab_result',
    'medication'
  ]));

alter table public.prenatal_logs
  add column if not exists hospital_name text,
  add column if not exists next_checkup_at date,
  add column if not exists kick_count integer,
  add column if not exists kick_duration_min integer,
  add column if not exists fundal_height_cm numeric,
  add column if not exists fetal_weight_est_g integer,
  add column if not exists medication_name text,
  add column if not exists lab_name text,
  add column if not exists lab_result_text text;
