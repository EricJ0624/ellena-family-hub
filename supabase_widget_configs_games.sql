-- Add 'games' dashboard widget key
-- widget_configs CHECK 제약 및 신규 그룹 시드·기존 그룹 백필

begin;

alter table public.widget_configs
  drop constraint if exists widget_configs_widget_key_check;

alter table public.widget_configs
  add constraint widget_configs_widget_key_check
  check (
    widget_key in ('tasks', 'calendar', 'chat', 'location', 'album', 'travel', 'piggy', 'games')
  );

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
    (new.id, 'piggy', true, 40),
    (new.id, 'travel', true, 50),
    (new.id, 'album', true, 60),
    (new.id, 'location', true, 70),
    (new.id, 'games', true, 80)
  on conflict (group_id, widget_key) do nothing;

  return new;
end;
$$;

insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
select g.id, 'games'::text, true, 80
from public.groups g
on conflict (group_id, widget_key) do nothing;

commit;
