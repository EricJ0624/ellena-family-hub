-- Stage rename draft (DO NOT run blindly in production)
-- Goal: public.family_messages -> public.family_chat_messages
-- Strategy: physical rename + compatibility view + realtime publication switch

begin;

-- 0) Guard
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'family_messages'
  ) then
    raise exception 'public.family_messages does not exist';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'family_chat_messages'
  ) then
    raise exception 'public.family_chat_messages already exists';
  end if;
end $$;

-- 1) Physical rename
alter table public.family_messages rename to family_chat_messages;

-- 2) Optional index rename for readability
alter index if exists public.idx_family_messages_group_id rename to idx_family_chat_messages_group_id;
alter index if exists public.idx_family_messages_sender_id rename to idx_family_chat_messages_sender_id;

-- 3) Compatibility view (old name)
create or replace view public.family_messages as
select * from public.family_chat_messages;

-- 4) Realtime publication switch
alter publication supabase_realtime drop table if exists public.family_messages;
alter publication supabase_realtime add table public.family_chat_messages;

commit;

-- Rollback (manual):
-- begin;
--   alter publication supabase_realtime drop table if exists public.family_chat_messages;
--   drop view if exists public.family_messages;
--   alter table public.family_chat_messages rename to family_messages;
--   alter index if exists public.idx_family_chat_messages_group_id rename to idx_family_messages_group_id;
--   alter index if exists public.idx_family_chat_messages_sender_id rename to idx_family_messages_sender_id;
--   alter publication supabase_realtime add table public.family_messages;
-- commit;

