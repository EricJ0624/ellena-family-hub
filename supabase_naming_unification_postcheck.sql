-- Post-check query set for naming-unification SQL runs
-- Safe read-only checks. Run after each rename batch.

-- 1) Table presence snapshot
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'feature_attachments',
    'attachments',
    'family_messages',
    'family_chat_messages',
    'memory_vault',
    'family_album_items'
  )
order by table_name;

-- 2) RLS state
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('attachments', 'family_chat_messages', 'family_album_items')
order by tablename;

-- 3) Policy snapshot
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'feature_attachments',
    'attachments',
    'family_messages',
    'family_chat_messages',
    'memory_vault',
    'family_album_items'
  )
order by tablename, policyname;

-- 4) FK snapshot around renamed targets
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and (
    tc.table_name in ('attachments', 'family_chat_messages', 'family_album_items', 'feature_attachments', 'family_messages', 'memory_vault')
    or ccu.table_name in ('attachments', 'family_chat_messages', 'family_album_items', 'feature_attachments', 'family_messages', 'memory_vault')
  )
order by tc.table_name, tc.constraint_name;

