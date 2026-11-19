-- 가족 할 일: 마감 일시, 서브태스크, 목록 템플릿, 마감 알림 발송 기록
-- 새 테이블 GRANT는 2024-10-30 이후 Data API 접근에 필수.

alter table public.family_tasks
  add column if not exists due_at timestamptz,
  add column if not exists remind_offsets_minutes integer[] not null default '{}'::integer[];

comment on column public.family_tasks.due_at is
  '마감 시각. null이면 알림 없음.';
comment on column public.family_tasks.remind_offsets_minutes is
  '마감 몇 분 전에 알릴지. 허용: 60(1시간 전), 0(정각). 빈 배열이면 알림 없음.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_tasks_remind_offsets_allowed'
  ) then
    alter table public.family_tasks
      add constraint family_tasks_remind_offsets_allowed
      check (remind_offsets_minutes <@ array[0, 60]::integer[]);
  end if;
end $$;

create index if not exists idx_family_tasks_due_open
  on public.family_tasks (due_at)
  where due_at is not null and is_completed is not true;

-- ---------------------------------------------------------------------------
-- Subtasks
-- ---------------------------------------------------------------------------

create table if not exists public.family_task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.family_tasks(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  app_id text not null default 'hearth_family',
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_family_task_subtasks_task
  on public.family_task_subtasks (task_id, sort_order);
create index if not exists idx_family_task_subtasks_group
  on public.family_task_subtasks (group_id);
create index if not exists idx_family_task_subtasks_app_id
  on public.family_task_subtasks (app_id);

drop trigger if exists trg_set_app_id_from_group on public.family_task_subtasks;
create trigger trg_set_app_id_from_group
  before insert or update of group_id
  on public.family_task_subtasks
  for each row
  execute function public.set_row_app_id_from_group();

-- ---------------------------------------------------------------------------
-- List templates (장보기 등). 임무와 연결하지 않아 원본을 지워도 남는다.
-- ---------------------------------------------------------------------------

create table if not exists public.family_task_list_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  app_id text not null default 'hearth_family',
  name text not null,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.family_task_list_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.family_task_list_templates(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  app_id text not null default 'hearth_family',
  title text not null,
  sort_order integer not null default 0
);

create index if not exists idx_family_task_list_templates_group
  on public.family_task_list_templates (group_id, created_at desc);
create index if not exists idx_family_task_list_templates_app_id
  on public.family_task_list_templates (app_id);
create index if not exists idx_family_task_list_template_items_template
  on public.family_task_list_template_items (template_id, sort_order);
create index if not exists idx_family_task_list_template_items_group
  on public.family_task_list_template_items (group_id);
create index if not exists idx_family_task_list_template_items_app_id
  on public.family_task_list_template_items (app_id);

drop trigger if exists trg_set_app_id_from_group on public.family_task_list_templates;
create trigger trg_set_app_id_from_group
  before insert or update of group_id
  on public.family_task_list_templates
  for each row
  execute function public.set_row_app_id_from_group();

drop trigger if exists trg_set_app_id_from_group on public.family_task_list_template_items;
create trigger trg_set_app_id_from_group
  before insert or update of group_id
  on public.family_task_list_template_items
  for each row
  execute function public.set_row_app_id_from_group();

-- ---------------------------------------------------------------------------
-- Reminder dispatches. 클라이언트 insert 는 RLS로 막고 service role만 기록.
-- ---------------------------------------------------------------------------

create table if not exists public.task_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.family_tasks(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  app_id text not null default 'hearth_family',
  offset_minutes integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint task_reminder_dispatches_offset_allowed
    check (offset_minutes = any (array[0, 60]::integer[])),
  constraint task_reminder_dispatches_unique
    unique (task_id, offset_minutes)
);

create index if not exists idx_task_reminder_dispatches_group
  on public.task_reminder_dispatches (group_id);
create index if not exists idx_task_reminder_dispatches_app_id
  on public.task_reminder_dispatches (app_id);

drop trigger if exists trg_set_app_id_from_group on public.task_reminder_dispatches;
create trigger trg_set_app_id_from_group
  before insert or update of group_id
  on public.task_reminder_dispatches
  for each row
  execute function public.set_row_app_id_from_group();

create or replace function public.clear_task_reminder_dispatches_on_due_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.due_at is distinct from old.due_at
     or new.remind_offsets_minutes is distinct from old.remind_offsets_minutes then
    delete from public.task_reminder_dispatches where task_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_task_reminder_dispatches_on_due_change() from public;

drop trigger if exists trg_clear_task_reminder_dispatches on public.family_tasks;
create trigger trg_clear_task_reminder_dispatches
  after update of due_at, remind_offsets_minutes
  on public.family_tasks
  for each row
  execute function public.clear_task_reminder_dispatches_on_due_change();

-- ---------------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------------

grant select on public.family_task_subtasks to anon;
grant select, insert, update, delete on public.family_task_subtasks to authenticated;
grant select, insert, update, delete on public.family_task_subtasks to service_role;

grant select on public.family_task_list_templates to anon;
grant select, insert, update, delete on public.family_task_list_templates to authenticated;
grant select, insert, update, delete on public.family_task_list_templates to service_role;

grant select on public.family_task_list_template_items to anon;
grant select, insert, update, delete on public.family_task_list_template_items to authenticated;
grant select, insert, update, delete on public.family_task_list_template_items to service_role;

grant select on public.task_reminder_dispatches to anon;
grant select, insert, update, delete on public.task_reminder_dispatches to authenticated;
grant select, insert, update, delete on public.task_reminder_dispatches to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.family_task_subtasks enable row level security;
alter table public.family_task_list_templates enable row level security;
alter table public.family_task_list_template_items enable row level security;
alter table public.task_reminder_dispatches enable row level security;

-- subtasks: 그룹 멤버 전원 읽기/쓰기
drop policy if exists "family_task_subtasks_select_member" on public.family_task_subtasks;
create policy "family_task_subtasks_select_member"
  on public.family_task_subtasks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = family_task_subtasks.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = family_task_subtasks.group_id and g.owner_id = auth.uid()
    )
  );

drop policy if exists "family_task_subtasks_insert_member" on public.family_task_subtasks;
create policy "family_task_subtasks_insert_member"
  on public.family_task_subtasks
  for insert
  to authenticated
  with check (
    group_id is not null
    and (
      exists (
        select 1 from public.memberships m
        where m.group_id = family_task_subtasks.group_id and m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.groups g
        where g.id = family_task_subtasks.group_id and g.owner_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.family_tasks t
      where t.id = family_task_subtasks.task_id
        and t.group_id = family_task_subtasks.group_id
    )
  );

drop policy if exists "family_task_subtasks_update_member" on public.family_task_subtasks;
create policy "family_task_subtasks_update_member"
  on public.family_task_subtasks
  for update
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = family_task_subtasks.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = family_task_subtasks.group_id and g.owner_id = auth.uid()
    )
  )
  with check (
    group_id is not null
    and (
      exists (
        select 1 from public.memberships m
        where m.group_id = family_task_subtasks.group_id and m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.groups g
        where g.id = family_task_subtasks.group_id and g.owner_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.family_tasks t
      where t.id = family_task_subtasks.task_id
        and t.group_id = family_task_subtasks.group_id
    )
  );

drop policy if exists "family_task_subtasks_delete_member" on public.family_task_subtasks;
create policy "family_task_subtasks_delete_member"
  on public.family_task_subtasks
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = family_task_subtasks.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = family_task_subtasks.group_id and g.owner_id = auth.uid()
    )
  );

-- templates: 그룹 멤버 전원
drop policy if exists "family_task_list_templates_member" on public.family_task_list_templates;
create policy "family_task_list_templates_member"
  on public.family_task_list_templates
  for all
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = family_task_list_templates.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = family_task_list_templates.group_id and g.owner_id = auth.uid()
    )
  )
  with check (
    group_id is not null
    and (
      exists (
        select 1 from public.memberships m
        where m.group_id = family_task_list_templates.group_id and m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.groups g
        where g.id = family_task_list_templates.group_id and g.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "family_task_list_template_items_member" on public.family_task_list_template_items;
create policy "family_task_list_template_items_member"
  on public.family_task_list_template_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = family_task_list_template_items.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = family_task_list_template_items.group_id and g.owner_id = auth.uid()
    )
  )
  with check (
    group_id is not null
    and (
      exists (
        select 1 from public.memberships m
        where m.group_id = family_task_list_template_items.group_id and m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.groups g
        where g.id = family_task_list_template_items.group_id and g.owner_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.family_task_list_templates tpl
      where tpl.id = family_task_list_template_items.template_id
        and tpl.group_id = family_task_list_template_items.group_id
    )
  );

-- dispatches: 멤버 읽기만. 쓰기는 service role.
drop policy if exists "task_reminder_dispatches_select_member" on public.task_reminder_dispatches;
create policy "task_reminder_dispatches_select_member"
  on public.task_reminder_dispatches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = task_reminder_dispatches.group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = task_reminder_dispatches.group_id and g.owner_id = auth.uid()
    )
  );

-- 앱 경계 + 정지 계정 (family_tasks 와 같은 RESTRICTIVE)
do $$
declare
  t text;
  tables text[] := array[
    'family_task_subtasks',
    'family_task_list_templates',
    'family_task_list_template_items',
    'task_reminder_dispatches'
  ];
begin
  foreach t in array tables
  loop
    execute format('drop policy if exists %I on public.%I', t || '_family_app_only', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (app_id = any (array[%L, %L, %L, %L]::text[]))
         with check (app_id = any (array[%L, %L, %L, %L]::text[]))',
      t || '_family_app_only',
      t,
      'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper',
      'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
    );

    execute format('drop policy if exists %I on public.%I', t || '_not_suspended', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not public.is_user_suspended_in_group(auth.uid(), group_id))
         with check (not public.is_user_suspended_in_group(auth.uid(), group_id))',
      t || '_not_suspended',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime (서브태스크만. 체크·진행률이 다른 화면에 바로 보이게)
-- ---------------------------------------------------------------------------

alter table public.family_task_subtasks replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'family_task_subtasks'
     ) then
    alter publication supabase_realtime add table public.family_task_subtasks;
  end if;
end $$;
