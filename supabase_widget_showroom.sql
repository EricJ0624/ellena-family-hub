-- Widget showroom (신규 그룹만): 완료 플래그 + 시드 기본 off
-- 레거시 그룹: completed_at 백필 → 쇼룸 스킵
-- 기존 widget_configs.is_enabled 는 변경하지 않음

begin;

alter table public.groups
  add column if not exists widget_showroom_completed_at timestamptz null;

comment on column public.groups.widget_showroom_completed_at is
  'Null = 생성자 위젯 쇼룸 미완료(마이그레이션 이후 신규 그룹만). Non-null = 완료 또는 레거시 스킵.';

-- 플래그 추가 시점 이전 그룹: 쇼룸 대상 아님 (마이그레이션 1회용 — 재실행 금지)
-- 재실행 시 신규 미완료 그룹(null)까지 완료 처리될 수 있음.
update public.groups
set widget_showroom_completed_at = coalesce(created_at, now())
where widget_showroom_completed_at is null;

create or replace function public.seed_widget_configs_for_new_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- 신규 그룹: 전부 off. 쇼룸에서 선택 저장 시에만 on.
  insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
  values
    (new.id, 'tasks', false, 10),
    (new.id, 'calendar', false, 20),
    (new.id, 'chat', false, 30),
    (new.id, 'piggy', false, 40),
    (new.id, 'travel', false, 50),
    (new.id, 'travel_diary', false, 55),
    (new.id, 'travel_quick_record', false, 56),
    (new.id, 'album', false, 60),
    (new.id, 'location', false, 70),
    (new.id, 'games', false, 80)
  on conflict (group_id, widget_key) do nothing;

  return new;
end;
$$;

commit;
