-- =============================================================================
-- Baby print albums — 그룹 공유 인쇄용 앨범 편집본
-- =============================================================================
begin;

create table if not exists public.baby_print_albums (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  baby_id         uuid not null references public.baby_profiles(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  title           text not null default '',
  bg              text not null default 'cream',
  layout          text not null default 'grid2',
  show_captions   boolean not null default true,
  photo_order     uuid[] not null default '{}',
  photo_edits     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint baby_print_albums_bg_check
    check (bg in ('cream', 'blush', 'sage', 'sky')),
  constraint baby_print_albums_layout_check
    check (layout in ('grid2', 'grid3', 'hero'))
);

create index if not exists idx_baby_print_albums_group_baby
  on public.baby_print_albums (group_id, baby_id, updated_at desc);

alter table public.baby_print_albums enable row level security;

drop policy if exists "baby_print_albums_select" on public.baby_print_albums;
create policy "baby_print_albums_select" on public.baby_print_albums
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_print_albums_insert" on public.baby_print_albums;
create policy "baby_print_albums_insert" on public.baby_print_albums
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "baby_print_albums_update" on public.baby_print_albums;
create policy "baby_print_albums_update" on public.baby_print_albums
  for update
  using (
    public.is_group_member(group_id, auth.uid())
    and created_by = auth.uid()
  )
  with check (
    public.is_group_member(group_id, auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists "baby_print_albums_delete" on public.baby_print_albums;
create policy "baby_print_albums_delete" on public.baby_print_albums
  for delete
  using (
    public.is_group_member(group_id, auth.uid())
    and created_by = auth.uid()
  );

grant select
  on public.baby_print_albums
  to anon;

grant select, insert, update, delete
  on public.baby_print_albums
  to authenticated;

grant select, insert, update, delete
  on public.baby_print_albums
  to service_role;

commit;
