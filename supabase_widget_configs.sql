-- Dashboard widget configs (owner-managed)
-- 액자는 고정이며, 아래 위젯들만 그룹 단위로 on/off + 순서 관리

begin;

create table if not exists public.widget_configs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  widget_key text not null check (
    widget_key in ('tasks', 'calendar', 'chat', 'location', 'album', 'travel', 'piggy')
  ),
  is_enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, widget_key)
);

create index if not exists idx_widget_configs_group_order
  on public.widget_configs(group_id, display_order);

create index if not exists idx_widget_configs_group_enabled
  on public.widget_configs(group_id, is_enabled);

create or replace function public.update_widget_configs_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_widget_configs_updated_at on public.widget_configs;
create trigger trg_widget_configs_updated_at
before update on public.widget_configs
for each row
execute function public.update_widget_configs_updated_at();

-- 새 그룹 생성 시 기본 위젯 설정 자동 생성
create or replace function public.seed_widget_configs_for_new_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
  values
    (new.id, 'tasks', true, 10),
    (new.id, 'calendar', true, 20),
    (new.id, 'chat', true, 30),
    (new.id, 'location', true, 40),
    (new.id, 'album', true, 50),
    (new.id, 'travel', true, 60),
    (new.id, 'piggy', true, 70)
  on conflict (group_id, widget_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_widget_configs_on_group_insert on public.groups;
create trigger trg_seed_widget_configs_on_group_insert
after insert on public.groups
for each row
execute function public.seed_widget_configs_for_new_group();

-- 기존 그룹 백필
insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
select g.id, v.widget_key, true, v.display_order
from public.groups g
cross join (
  values
    ('tasks'::text, 10),
    ('calendar'::text, 20),
    ('chat'::text, 30),
    ('location'::text, 40),
    ('album'::text, 50),
    ('travel'::text, 60),
    ('piggy'::text, 70)
) as v(widget_key, display_order)
on conflict (group_id, widget_key) do nothing;

alter table public.widget_configs enable row level security;

drop policy if exists "widget_configs_select_members" on public.widget_configs;
create policy "widget_configs_select_members"
on public.widget_configs
for select
using (
  exists (
    select 1
    from public.memberships m
    where m.group_id = widget_configs.group_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "widget_configs_insert_owner_only" on public.widget_configs;
create policy "widget_configs_insert_owner_only"
on public.widget_configs
for insert
with check (
  exists (
    select 1
    from public.groups g
    where g.id = widget_configs.group_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists "widget_configs_update_owner_only" on public.widget_configs;
create policy "widget_configs_update_owner_only"
on public.widget_configs
for update
using (
  exists (
    select 1
    from public.groups g
    where g.id = widget_configs.group_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.groups g
    where g.id = widget_configs.group_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists "widget_configs_delete_owner_only" on public.widget_configs;
create policy "widget_configs_delete_owner_only"
on public.widget_configs
for delete
using (
  exists (
    select 1
    from public.groups g
    where g.id = widget_configs.group_id
      and g.owner_id = auth.uid()
  )
);

commit;

