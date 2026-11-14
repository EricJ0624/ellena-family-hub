-- 평소 취침/기상, 수면 실기록 구분, 증상 로그, 성장 위젯 기본 높이 +1
alter table public.baby_profiles
  add column if not exists usual_bedtime time,
  add column if not exists usual_wake_time time;

alter table public.baby_daily_logs
  add column if not exists sleep_start_recorded boolean,
  add column if not exists sleep_end_recorded boolean,
  add column if not exists symptom_tags text;

alter table public.baby_daily_logs drop constraint if exists baby_daily_logs_log_type_check;
alter table public.baby_daily_logs
  add constraint baby_daily_logs_log_type_check
  check (log_type = any (array['feeding','sleep','diaper','temperature','medication','activity','symptom']));

update public.widget_configs
set
  layout_h = case when layout_h = 8 then 9 else layout_h end,
  layout_portrait_h = case when layout_portrait_h = 8 then 9 else layout_portrait_h end,
  layout_landscape_h = case when layout_landscape_h = 8 then 9 else layout_landscape_h end
where widget_key = 'baby_growth';
