-- Feature attachments for chat/piggy/travel
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.feature_attachments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  feature_type text not null check (feature_type in ('chat', 'piggy', 'travel')),
  entity_type text not null check (
    entity_type in (
      'chat_message',
      'piggy_wallet_tx',
      'piggy_bank_tx',
      'travel_trip',
      'travel_expense'
    )
  ),
  entity_id uuid not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  s3_key text not null,
  image_url text not null,
  thumbnail_s3_key text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_feature_attachments_group_entity
  on public.feature_attachments (group_id, entity_type, entity_id, created_at desc);

create index if not exists idx_feature_attachments_uploader
  on public.feature_attachments (uploader_id, created_at desc);

create index if not exists idx_feature_attachments_feature
  on public.feature_attachments (group_id, feature_type, created_at desc);

alter table public.feature_attachments enable row level security;

drop policy if exists "feature_attachments_select_member" on public.feature_attachments;
create policy "feature_attachments_select_member"
on public.feature_attachments
for select
using (
  deleted_at is null and (
    exists (
      select 1
      from public.memberships m
      where m.group_id = feature_attachments.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.groups g
      where g.id = feature_attachments.group_id
        and g.owner_id = auth.uid()
    )
  )
);

drop policy if exists "feature_attachments_insert_member" on public.feature_attachments;
create policy "feature_attachments_insert_member"
on public.feature_attachments
for insert
with check (
  auth.uid() = uploader_id
  and exists (
    select 1
    from public.memberships m
    where m.group_id = feature_attachments.group_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "feature_attachments_delete_owner_or_admin" on public.feature_attachments;
create policy "feature_attachments_delete_owner_or_admin"
on public.feature_attachments
for delete
using (
  uploader_id = auth.uid()
  or exists (
    select 1
    from public.memberships m
    where m.group_id = feature_attachments.group_id
      and m.user_id = auth.uid()
      and m.role = 'ADMIN'
  )
  or exists (
    select 1
    from public.groups g
    where g.id = feature_attachments.group_id
      and g.owner_id = auth.uid()
  )
);
