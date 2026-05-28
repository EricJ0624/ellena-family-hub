-- widget_configs: portrait / landscape 독립 레이아웃 컬럼 추가 (Phase A)
-- 기존 layout_x/y/w/h 는 deprecated 유지 (Phase D 완료 후 제거)
-- RLS 정책 변경 없음
-- 기존 앱 동작 변경 없음 (새 컬럼은 nullable, Phase D에서 사용)

begin;

-- ─── Portrait 컬럼 추가 ───────────────────────────────────────────────────────
-- 12열 × 24행 기준 (세로 화면)

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_portrait_x')
  then alter table public.widget_configs add column layout_portrait_x numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_portrait_y')
  then alter table public.widget_configs add column layout_portrait_y numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_portrait_w')
  then alter table public.widget_configs add column layout_portrait_w numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_portrait_h')
  then alter table public.widget_configs add column layout_portrait_h numeric(8,3) null; end if;
end $$;

-- ─── Landscape 컬럼 추가 ─────────────────────────────────────────────────────
-- 24열 × 12행 기준 (가로 화면, Phase B에서 24열로 전환)

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_landscape_x')
  then alter table public.widget_configs add column layout_landscape_x numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_landscape_y')
  then alter table public.widget_configs add column layout_landscape_y numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_landscape_w')
  then alter table public.widget_configs add column layout_landscape_w numeric(8,3) null; end if;
end $$;

do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='widget_configs' and column_name='layout_landscape_h')
  then alter table public.widget_configs add column layout_landscape_h numeric(8,3) null; end if;
end $$;

-- ─── CHECK 제약 추가 ─────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_constraint where conname='widget_configs_layout_portrait_w_check') then
    alter table public.widget_configs
      add constraint widget_configs_layout_portrait_w_check
      check (layout_portrait_w is null or (layout_portrait_w > 0 and layout_portrait_w <= 12));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='widget_configs_layout_portrait_h_check') then
    alter table public.widget_configs
      add constraint widget_configs_layout_portrait_h_check
      check (layout_portrait_h is null or layout_portrait_h > 0);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='widget_configs_layout_landscape_w_check') then
    alter table public.widget_configs
      add constraint widget_configs_layout_landscape_w_check
      check (layout_landscape_w is null or (layout_landscape_w > 0 and layout_landscape_w <= 24));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='widget_configs_layout_landscape_h_check') then
    alter table public.widget_configs
      add constraint widget_configs_layout_landscape_h_check
      check (layout_landscape_h is null or layout_landscape_h > 0);
  end if;
end $$;

-- ─── 기존 데이터 백필 ────────────────────────────────────────────────────────
-- portrait: 기존 layout_* 그대로 복사 (12열 단위 동일)
-- landscape: layout_w/x × 2 (12열 → 24열 비율 보존), layout_h/y 동일

update public.widget_configs
set
  layout_portrait_x = layout_x,
  layout_portrait_y = layout_y,
  layout_portrait_w = layout_w,
  layout_portrait_h = layout_h,
  layout_landscape_x = case when layout_x is not null then layout_x * 2 else null end,
  layout_landscape_y = layout_y,
  layout_landscape_w = case when layout_w is not null then layout_w * 2 else null end,
  layout_landscape_h = layout_h
where layout_portrait_w is null  -- 이미 백필된 행 스킵
  and layout_w is not null;

-- ─── 시드 트리거 업데이트 ────────────────────────────────────────────────────
-- 신규 그룹 생성 시 portrait/landscape 컬럼도 함께 채움

create or replace function public.seed_widget_configs_for_new_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_widgets  text[]   := array['tasks','calendar','chat','location','album','travel','piggy'];
  v_orders   int[]    := array[10, 20, 30, 40, 50, 60, 70];
  -- portrait 기준 (12열 × 24행): M 사이즈 = w:6, h:3
  v_pw       numeric  := 6;
  v_ph       numeric  := 3;
  v_pbase    int      := 12;
  -- landscape 기준 (24열 × 12행): M 사이즈 = w:12, h:3
  v_lw       numeric  := 12;
  v_lh       numeric  := 3;
  v_lbase    int      := 24;
  -- portrait 패킹 커서
  v_pcx      numeric  := 0;
  v_pcy      numeric  := 0;
  v_prow_h   numeric  := 0;
  -- landscape 패킹 커서
  v_lcx      numeric  := 0;
  v_lcy      numeric  := 0;
  v_lrow_h   numeric  := 0;
  i          int;
begin
  for i in 1..array_length(v_widgets, 1) loop
    -- portrait 행 넘침
    if v_pcx + v_pw > v_pbase then
      v_pcy    := v_pcy + v_prow_h;
      v_pcx    := 0;
      v_prow_h := 0;
    end if;
    -- landscape 행 넘침
    if v_lcx + v_lw > v_lbase then
      v_lcy    := v_lcy + v_lrow_h;
      v_lcx    := 0;
      v_lrow_h := 0;
    end if;

    insert into public.widget_configs (
      group_id, widget_key, is_enabled, display_order,
      size, col_span, row_span,
      layout_x, layout_y, layout_w, layout_h, layout_version,
      layout_portrait_x, layout_portrait_y, layout_portrait_w, layout_portrait_h,
      layout_landscape_x, layout_landscape_y, layout_landscape_w, layout_landscape_h
    ) values (
      new.id, v_widgets[i], true, v_orders[i],
      'M', 1, 1,
      v_pcx, v_pcy, v_pw, v_ph, 1,
      v_pcx, v_pcy, v_pw, v_ph,
      v_lcx, v_lcy, v_lw, v_lh
    )
    on conflict (group_id, widget_key) do nothing;

    v_pcx    := v_pcx + v_pw;
    v_prow_h := greatest(v_prow_h, v_ph);
    v_lcx    := v_lcx + v_lw;
    v_lrow_h := greatest(v_lrow_h, v_lh);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_seed_widget_configs_on_group_insert on public.groups;
create trigger trg_seed_widget_configs_on_group_insert
after insert on public.groups
for each row
execute function public.seed_widget_configs_for_new_group();

commit;
