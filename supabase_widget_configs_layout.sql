-- widget_configs: 그리드 레이아웃 메타(size, span, priority 등)
-- RLS/정책 변경 없음 — 컬럼 추가만

begin;

-- size
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'size'
  ) then
    alter table public.widget_configs
      add column size text not null default 'M';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'widget_configs_size_check'
  ) then
    alter table public.widget_configs drop constraint widget_configs_size_check;
  end if;
end $$;

alter table public.widget_configs
  add constraint widget_configs_size_check
  check (size in ('S', 'M', 'L', 'XL'));

alter table public.widget_configs
  alter column size set default 'M';

-- col_span
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'col_span'
  ) then
    alter table public.widget_configs
      add column col_span integer not null default 1;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'widget_configs_col_span_check'
  ) then
    alter table public.widget_configs drop constraint widget_configs_col_span_check;
  end if;
end $$;

alter table public.widget_configs
  add constraint widget_configs_col_span_check
  check (col_span >= 1 and col_span <= 4);

-- row_span
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'row_span'
  ) then
    alter table public.widget_configs
      add column row_span integer not null default 1;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'widget_configs_row_span_check'
  ) then
    alter table public.widget_configs drop constraint widget_configs_row_span_check;
  end if;
end $$;

alter table public.widget_configs
  add constraint widget_configs_row_span_check
  check (row_span >= 1 and row_span <= 6);

-- min_w / min_h (nullable, 그리드 최소 트랙 힌트용 예약)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'min_w'
  ) then
    alter table public.widget_configs add column min_w integer null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'min_h'
  ) then
    alter table public.widget_configs add column min_h integer null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'widget_configs_min_w_check'
  ) then
    alter table public.widget_configs drop constraint widget_configs_min_w_check;
  end if;
end $$;

alter table public.widget_configs
  add constraint widget_configs_min_w_check
  check (min_w is null or (min_w >= 1 and min_w <= 4));

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'widget_configs_min_h_check'
  ) then
    alter table public.widget_configs drop constraint widget_configs_min_h_check;
  end if;
end $$;

alter table public.widget_configs
  add constraint widget_configs_min_h_check
  check (min_h is null or (min_h >= 1 and min_h <= 6));

-- priority (표시 순서 보조 / 향후 확장)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'widget_configs'
      and column_name = 'priority'
  ) then
    alter table public.widget_configs
      add column priority integer not null default 0;
  end if;
end $$;

commit;
