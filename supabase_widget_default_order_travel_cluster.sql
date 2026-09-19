-- DEFAULT 위젯 순서: 여행 플래너(50) 바로 아래 → 다이어리(55) → 빠른 기록(56)
-- layout_* 좌표는 변경하지 않음. display_order만 맞춤.
begin;

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
    (new.id, 'travel_diary', false, 55),
    (new.id, 'travel_quick_record', true, 56),
    (new.id, 'album', true, 60),
    (new.id, 'location', true, 70),
    (new.id, 'games', true, 80)
  on conflict (group_id, widget_key) do nothing;

  return new;
end;
$$;

-- 기존 그룹: 예전 기본값(85/86)만 새 DEFAULT로 갱신 (수동 재배치한 순서는 유지)
update public.widget_configs
set display_order = 55
where widget_key = 'travel_diary'
  and display_order = 85;

update public.widget_configs
set display_order = 56
where widget_key = 'travel_quick_record'
  and display_order = 86;

commit;
