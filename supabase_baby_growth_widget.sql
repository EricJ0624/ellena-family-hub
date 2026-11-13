-- =============================================================================
-- Baby Growth Widget — DB Migration
-- 아기 성장기록 위젯용 5개 테이블 생성
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. baby_profiles — 아기 기본 정보
-- ---------------------------------------------------------------------------
create table if not exists public.baby_profiles (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  name            text not null,
  birth_date      date not null,
  gender          text check (gender in ('male', 'female', 'other')),
  avatar_url      text,
  country_code    text not null default 'KR',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_baby_profiles_group
  on public.baby_profiles (group_id, created_at desc);

alter table public.baby_profiles enable row level security;

drop policy if exists "baby_profiles_select" on public.baby_profiles;
create policy "baby_profiles_select" on public.baby_profiles
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_profiles_insert" on public.baby_profiles;
create policy "baby_profiles_insert" on public.baby_profiles
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_profiles_update" on public.baby_profiles;
create policy "baby_profiles_update" on public.baby_profiles
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_profiles_delete" on public.baby_profiles;
create policy "baby_profiles_delete" on public.baby_profiles
  for delete using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. baby_daily_logs — 수유/수면/배변/체온/투약 로그
-- ---------------------------------------------------------------------------
create table if not exists public.baby_daily_logs (
  id                    uuid primary key default gen_random_uuid(),
  baby_id               uuid not null references public.baby_profiles(id) on delete cascade,
  group_id              uuid not null references public.groups(id) on delete cascade,
  log_type              text not null check (log_type in ('feeding', 'sleep', 'diaper', 'temperature', 'medication')),
  logged_at             timestamptz not null default now(),
  -- feeding
  feeding_type          text check (feeding_type in ('breast_left', 'breast_right', 'bottle', 'solid', 'mixed')),
  feeding_amount_ml     integer,
  feeding_duration_min  integer,
  -- sleep
  sleep_end_at          timestamptz,
  -- diaper
  diaper_type           text check (diaper_type in ('wet', 'dirty', 'mixed', 'dry')),
  -- temperature
  temperature_celsius   numeric(4, 1),
  -- medication
  medication_name       text,
  medication_dose_mg    numeric(6, 2),
  -- shared
  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists idx_baby_daily_logs_baby_logged
  on public.baby_daily_logs (baby_id, logged_at desc);

create index if not exists idx_baby_daily_logs_group
  on public.baby_daily_logs (group_id, logged_at desc);

alter table public.baby_daily_logs enable row level security;

drop policy if exists "baby_daily_logs_select" on public.baby_daily_logs;
create policy "baby_daily_logs_select" on public.baby_daily_logs
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_daily_logs_insert" on public.baby_daily_logs;
create policy "baby_daily_logs_insert" on public.baby_daily_logs
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_daily_logs_update" on public.baby_daily_logs;
create policy "baby_daily_logs_update" on public.baby_daily_logs
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_daily_logs_delete" on public.baby_daily_logs;
create policy "baby_daily_logs_delete" on public.baby_daily_logs
  for delete using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. baby_growth_records — 신체 성장 측정값
-- ---------------------------------------------------------------------------
create table if not exists public.baby_growth_records (
  id            uuid primary key default gen_random_uuid(),
  baby_id       uuid not null references public.baby_profiles(id) on delete cascade,
  group_id      uuid not null references public.groups(id) on delete cascade,
  measured_at   date not null,
  weight_kg     numeric(5, 3),
  height_cm     numeric(5, 1),
  head_cm       numeric(5, 1),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_baby_growth_records_baby
  on public.baby_growth_records (baby_id, measured_at desc);

alter table public.baby_growth_records enable row level security;

drop policy if exists "baby_growth_records_select" on public.baby_growth_records;
create policy "baby_growth_records_select" on public.baby_growth_records
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_growth_records_insert" on public.baby_growth_records;
create policy "baby_growth_records_insert" on public.baby_growth_records
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_growth_records_update" on public.baby_growth_records;
create policy "baby_growth_records_update" on public.baby_growth_records
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_growth_records_delete" on public.baby_growth_records;
create policy "baby_growth_records_delete" on public.baby_growth_records
  for delete using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. baby_milestones — 발달 마일스톤
-- ---------------------------------------------------------------------------
create table if not exists public.baby_milestones (
  id              uuid primary key default gen_random_uuid(),
  baby_id         uuid not null references public.baby_profiles(id) on delete cascade,
  group_id        uuid not null references public.groups(id) on delete cascade,
  category        text not null check (category in ('motor', 'language', 'social', 'cognitive', 'sensory')),
  milestone_key   text not null,
  achieved_at     date,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_baby_milestones_unique_key
  on public.baby_milestones (baby_id, milestone_key);

create index if not exists idx_baby_milestones_baby
  on public.baby_milestones (baby_id, category);

alter table public.baby_milestones enable row level security;

drop policy if exists "baby_milestones_select" on public.baby_milestones;
create policy "baby_milestones_select" on public.baby_milestones
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_milestones_insert" on public.baby_milestones;
create policy "baby_milestones_insert" on public.baby_milestones
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_milestones_update" on public.baby_milestones;
create policy "baby_milestones_update" on public.baby_milestones
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_milestones_delete" on public.baby_milestones;
create policy "baby_milestones_delete" on public.baby_milestones
  for delete using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. baby_vaccinations — 예방접종 기록
-- ---------------------------------------------------------------------------
create table if not exists public.baby_vaccinations (
  id                uuid primary key default gen_random_uuid(),
  baby_id           uuid not null references public.baby_profiles(id) on delete cascade,
  group_id          uuid not null references public.groups(id) on delete cascade,
  vaccine_key       text not null,
  scheduled_at      date,
  administered_at   date,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create unique index if not exists idx_baby_vaccinations_unique_key
  on public.baby_vaccinations (baby_id, vaccine_key);

create index if not exists idx_baby_vaccinations_baby
  on public.baby_vaccinations (baby_id, scheduled_at asc);

alter table public.baby_vaccinations enable row level security;

drop policy if exists "baby_vaccinations_select" on public.baby_vaccinations;
create policy "baby_vaccinations_select" on public.baby_vaccinations
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_vaccinations_insert" on public.baby_vaccinations;
create policy "baby_vaccinations_insert" on public.baby_vaccinations
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_vaccinations_update" on public.baby_vaccinations;
create policy "baby_vaccinations_update" on public.baby_vaccinations
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_vaccinations_delete" on public.baby_vaccinations;
create policy "baby_vaccinations_delete" on public.baby_vaccinations
  for delete using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- GRANT — supabase-grant-new-table.mdc 규칙 준수 (신규 테이블 필수)
-- ---------------------------------------------------------------------------
grant select
  on public.baby_profiles, public.baby_daily_logs, public.baby_growth_records,
     public.baby_milestones, public.baby_vaccinations
  to anon;

grant select, insert, update, delete
  on public.baby_profiles, public.baby_daily_logs, public.baby_growth_records,
     public.baby_milestones, public.baby_vaccinations
  to authenticated;

grant select, insert, update, delete
  on public.baby_profiles, public.baby_daily_logs, public.baby_growth_records,
     public.baby_milestones, public.baby_vaccinations
  to service_role;

-- ---------------------------------------------------------------------------
-- widget_configs constraint 갱신 — 'baby_growth' 키 추가
-- ---------------------------------------------------------------------------
alter table public.widget_configs
  drop constraint if exists widget_configs_widget_key_check;

alter table public.widget_configs
  add constraint widget_configs_widget_key_check
  check (
    widget_key in (
      'tasks', 'calendar', 'chat', 'location', 'album', 'travel', 'piggy', 'games',
      'travel_diary', 'travel_quick_record', 'family_log', 'baby_growth'
    )
  );

-- 기존 그룹들에 baby_growth 위젯 행 시드 (기본 비활성화)
insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
select g.id, 'baby_growth'::text, false, 59
from public.groups g
on conflict (group_id, widget_key) do nothing;

commit;
