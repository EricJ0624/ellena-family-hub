-- =============================================================================
-- Prenatal & Birth Phase — baby_profiles 확장 + prenatal_logs + baby_birth_events
-- =============================================================================

-- 1) baby_profiles: birth_date nullable, due_date 영구 앵커
alter table public.baby_profiles
  alter column birth_date drop not null;

alter table public.baby_profiles
  add column if not exists due_date date;

alter table public.baby_profiles drop constraint if exists baby_profiles_due_or_birth_check;
alter table public.baby_profiles
  add constraint baby_profiles_due_or_birth_check
  check (birth_date is not null or due_date is not null);

comment on column public.baby_profiles.due_date is '출산예정일 — prenatal 앵커, 출산 후에도 유지';
comment on column public.baby_profiles.birth_date is '출생일 — null이면 Prenatal 모드';

-- 2) prenatal_logs
create table if not exists public.prenatal_logs (
  id                uuid primary key default gen_random_uuid(),
  baby_id           uuid not null references public.baby_profiles(id) on delete cascade,
  group_id          uuid not null references public.groups(id) on delete cascade,
  log_type          text not null check (log_type in (
    'maternal_weight', 'blood_pressure', 'symptom', 'diary', 'fetal_size', 'checkup_note'
  )),
  logged_at         timestamptz not null default now(),
  weight_kg         numeric,
  systolic          integer,
  diastolic         integer,
  symptom_tags      text,
  notes             text,
  fetal_size_label  text,
  checkup_at        date,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_prenatal_logs_baby_logged
  on public.prenatal_logs (baby_id, logged_at desc);

create index if not exists idx_prenatal_logs_group
  on public.prenatal_logs (group_id, logged_at desc);

alter table public.prenatal_logs enable row level security;

drop policy if exists "prenatal_logs_select" on public.prenatal_logs;
create policy "prenatal_logs_select" on public.prenatal_logs
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "prenatal_logs_insert" on public.prenatal_logs;
create policy "prenatal_logs_insert" on public.prenatal_logs
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "prenatal_logs_update" on public.prenatal_logs;
create policy "prenatal_logs_update" on public.prenatal_logs
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "prenatal_logs_delete" on public.prenatal_logs;
create policy "prenatal_logs_delete" on public.prenatal_logs
  for delete using (public.is_group_member(group_id, auth.uid()));

grant select on public.prenatal_logs to anon;
grant select, insert, update, delete on public.prenatal_logs to authenticated;
grant select, insert, update, delete on public.prenatal_logs to service_role;

-- 3) baby_birth_events
create table if not exists public.baby_birth_events (
  id                  uuid primary key default gen_random_uuid(),
  baby_id             uuid not null references public.baby_profiles(id) on delete cascade,
  group_id            uuid not null references public.groups(id) on delete cascade,
  delivered_at        timestamptz not null,
  legal_name          text not null,
  birth_weight_kg     numeric,
  birth_height_cm     numeric,
  birth_head_cm       numeric,
  birth_place         text,
  blood_type          text,
  gestational_weeks   numeric(4,1),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_baby_birth_events_baby
  on public.baby_birth_events (baby_id, created_at desc);

alter table public.baby_birth_events enable row level security;

drop policy if exists "baby_birth_events_select" on public.baby_birth_events;
create policy "baby_birth_events_select" on public.baby_birth_events
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_birth_events_insert" on public.baby_birth_events;
create policy "baby_birth_events_insert" on public.baby_birth_events
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_birth_events_update" on public.baby_birth_events;
create policy "baby_birth_events_update" on public.baby_birth_events
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_birth_events_delete" on public.baby_birth_events;
create policy "baby_birth_events_delete" on public.baby_birth_events
  for delete using (public.is_group_member(group_id, auth.uid()));

grant select on public.baby_birth_events to anon;
grant select, insert, update, delete on public.baby_birth_events to authenticated;
grant select, insert, update, delete on public.baby_birth_events to service_role;

-- birth_event_id FK (컬럼은 이미 있음)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'baby_profiles_birth_event_id_fkey'
  ) then
    alter table public.baby_profiles
      add constraint baby_profiles_birth_event_id_fkey
      foreign key (birth_event_id) references public.baby_birth_events(id) on delete set null;
  end if;
end $$;
