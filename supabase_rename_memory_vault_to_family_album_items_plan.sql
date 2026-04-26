-- Stage rename draft (DO NOT run blindly in production)
-- Goal: public.memory_vault -> public.family_album_items
-- Strategy: physical rename + compatibility view + realtime publication switch

begin;

-- 0) Guard
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'memory_vault'
  ) then
    raise exception 'public.memory_vault does not exist';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'family_album_items'
  ) then
    raise exception 'public.family_album_items already exists';
  end if;
end $$;

-- 1) Physical rename
alter table public.memory_vault rename to family_album_items;

-- 2) Optional index rename for readability
alter index if exists public.idx_memory_vault_group_id rename to idx_family_album_items_group_id;
alter index if exists public.idx_memory_vault_uploader_id rename to idx_family_album_items_uploader_id;

-- 3) Compatibility view (old name)
create or replace view public.memory_vault as
select * from public.family_album_items;

-- 4) Realtime publication switch
alter publication supabase_realtime drop table if exists public.memory_vault;
alter publication supabase_realtime add table public.family_album_items;

commit;

-- Rollback (manual):
-- begin;
--   alter publication supabase_realtime drop table if exists public.family_album_items;
--   drop view if exists public.memory_vault;
--   alter table public.family_album_items rename to memory_vault;
--   alter index if exists public.idx_family_album_items_group_id rename to idx_memory_vault_group_id;
--   alter index if exists public.idx_family_album_items_uploader_id rename to idx_memory_vault_uploader_id;
--   alter publication supabase_realtime add table public.memory_vault;
-- commit;

