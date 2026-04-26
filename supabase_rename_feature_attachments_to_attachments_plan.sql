-- Stage 4 draft (DO NOT run blindly in production)
-- Goal: move from public.feature_attachments to public.attachments safely.
-- Strategy: rename physical table, then create compatibility view with old name.
-- Preconditions:
-- 1) 앱 코드가 DB_TABLES.ATTACHMENTS 경유로 테이블명을 참조할 것
-- 2) 배치 전/후 핵심 시나리오(채팅 첨부/여행 첨부/업로드/삭제) 수동 검증

begin;

-- 0) Guard: target table must exist, new name must be free.
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'feature_attachments'
  ) then
    raise exception 'public.feature_attachments does not exist';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'attachments'
  ) then
    raise exception 'public.attachments already exists';
  end if;
end $$;

-- 1) Physical rename
alter table public.feature_attachments rename to attachments;

-- 2) Index rename (optional but recommended for readability)
alter index if exists public.idx_feature_attachments_group_entity rename to idx_attachments_group_entity;
alter index if exists public.idx_feature_attachments_uploader rename to idx_attachments_uploader;
alter index if exists public.idx_feature_attachments_feature rename to idx_attachments_feature;

-- 3) Policy rename (optional, functionally unchanged)
alter policy "feature_attachments_select_member" on public.attachments rename to "attachments_select_member";
alter policy "feature_attachments_insert_member" on public.attachments rename to "attachments_insert_member";
alter policy "feature_attachments_delete_owner_or_admin" on public.attachments rename to "attachments_delete_owner_or_admin";

-- 4) Compatibility view for old name (read/write passthrough for simple SELECT/INSERT/UPDATE/DELETE patterns)
--    This keeps old SQL and older clients from failing immediately.
create or replace view public.feature_attachments as
select * from public.attachments;

-- 5) Realtime publication: move from old table to new table
alter publication supabase_realtime drop table if exists public.feature_attachments;
alter publication supabase_realtime add table public.attachments;

commit;

-- Rollback plan (manual, run only when needed):
-- begin;
--   alter publication supabase_realtime drop table if exists public.attachments;
--   drop view if exists public.feature_attachments;
--   alter table public.attachments rename to feature_attachments;
--   alter index if exists public.idx_attachments_group_entity rename to idx_feature_attachments_group_entity;
--   alter index if exists public.idx_attachments_uploader rename to idx_feature_attachments_uploader;
--   alter index if exists public.idx_attachments_feature rename to idx_feature_attachments_feature;
--   alter policy "attachments_select_member" on public.feature_attachments rename to "feature_attachments_select_member";
--   alter policy "attachments_insert_member" on public.feature_attachments rename to "feature_attachments_insert_member";
--   alter policy "attachments_delete_owner_or_admin" on public.feature_attachments rename to "feature_attachments_delete_owner_or_admin";
--   alter publication supabase_realtime add table public.feature_attachments;
-- commit;
