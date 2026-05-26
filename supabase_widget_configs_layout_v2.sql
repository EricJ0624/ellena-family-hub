-- widget_configs: 12열 정규화 레이아웃 좌표 추가 (Phase 1)
-- 기존 col_span / row_span / size CHECK 제약 변경 없음
-- RLS 정책 변경 없음

begin;

-- layout_x
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'layout_x'
  ) then
    alter table public.widget_configs add column layout_x numeric(6,3) null;
  end if;
end $$;

-- layout_y
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'layout_y'
  ) then
    alter table public.widget_configs add column layout_y numeric(6,3) null;
  end if;
end $$;

-- layout_w
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'layout_w'
  ) then
    alter table public.widget_configs add column layout_w numeric(6,3) null;
  end if;
end $$;

-- layout_h
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'layout_h'
  ) then
    alter table public.widget_configs add column layout_h numeric(6,3) null;
  end if;
end $$;

-- layout_version
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'layout_version'
  ) then
    alter table public.widget_configs add column layout_version integer not null default 1;
  end if;
end $$;

-- CHECK: layout_x >= 0
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_configs_layout_x_check'
  ) then
    alter table public.widget_configs
      add constraint widget_configs_layout_x_check
      check (layout_x is null or layout_x >= 0);
  end if;
end $$;

-- CHECK: layout_y >= 0
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_configs_layout_y_check'
  ) then
    alter table public.widget_configs
      add constraint widget_configs_layout_y_check
      check (layout_y is null or layout_y >= 0);
  end if;
end $$;

-- CHECK: layout_w > 0 이고, x+w <= 12 (둘 다 null이 아닐 때만)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_configs_layout_w_check'
  ) then
    alter table public.widget_configs
      add constraint widget_configs_layout_w_check
      check (
        layout_w is null
        or (
          layout_w > 0
          and (layout_x is null or layout_x + layout_w <= 12)
        )
      );
  end if;
end $$;

-- CHECK: layout_h > 0
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_configs_layout_h_check'
  ) then
    alter table public.widget_configs
      add constraint widget_configs_layout_h_check
      check (layout_h is null or layout_h > 0);
  end if;
end $$;

-- 신규 그룹 시드 트리거 함수: layout_* 기본값 포함
-- 기본값: 모든 위젯 M 사이즈, 12열 기준 w=6, h=3, display_order 순 자동 패킹
-- layout_x/y는 display_order 순 top-left 패킹 (각 행 12열 기준)
create or replace function public.seed_widget_configs_for_new_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_widgets text[] := array['tasks','calendar','chat','location','album','travel','piggy'];
  v_orders  int[]  := array[10, 20, 30, 40, 50, 60, 70];
  v_w       numeric := 6;
  v_h       numeric := 3;
  v_base    int    := 12;
  v_cx      numeric := 0;
  v_cy      numeric := 0;
  v_row_h   numeric := 0;
  i         int;
begin
  for i in 1..array_length(v_widgets, 1) loop
    -- 행 넘침 처리
    if v_cx + v_w > v_base then
      v_cy := v_cy + v_row_h;
      v_cx := 0;
      v_row_h := 0;
    end if;

    insert into public.widget_configs (
      group_id, widget_key, is_enabled, display_order,
      size, col_span, row_span,
      layout_x, layout_y, layout_w, layout_h, layout_version
    ) values (
      new.id, v_widgets[i], true, v_orders[i],
      'M', 1, 1,
      v_cx, v_cy, v_w, v_h, 1
    )
    on conflict (group_id, widget_key) do nothing;

    v_cx    := v_cx + v_w;
    v_row_h := greatest(v_row_h, v_h);
  end loop;

  return new;
end;
$$;

-- 트리거 재등록 (함수가 교체되었으므로 drop/create)
drop trigger if exists trg_seed_widget_configs_on_group_insert on public.groups;
create trigger trg_seed_widget_configs_on_group_insert
after insert on public.groups
for each row
execute function public.seed_widget_configs_for_new_group();

commit;
