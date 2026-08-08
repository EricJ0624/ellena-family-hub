-- Picture Find Phase 2: group scene uploads + manage policies + size tracking
begin;

alter table public.picture_find_scenes
  add column if not exists image_s3_key text,
  add column if not exists variant_image_s3_key text,
  add column if not exists image_size_bytes bigint not null default 0
    check (image_size_bytes >= 0),
  add column if not exists variant_image_size_bytes bigint not null default 0
    check (variant_image_size_bytes >= 0);

-- Group members may insert their own group-scoped scenes
drop policy if exists "picture_find_scenes_insert_group_member" on public.picture_find_scenes;
create policy "picture_find_scenes_insert_group_member"
on public.picture_find_scenes
for insert
to authenticated
with check (
  scope = 'group'
  and group_id is not null
  and created_by = auth.uid()
  and public.is_family_game_group_member(group_id)
);

-- Uploader or group admin may soft-update (e.g. deactivate)
drop policy if exists "picture_find_scenes_update_group_manage" on public.picture_find_scenes;
create policy "picture_find_scenes_update_group_manage"
on public.picture_find_scenes
for update
to authenticated
using (
  scope = 'group'
  and group_id is not null
  and public.is_family_game_group_member(group_id)
  and (
    created_by = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.group_id = picture_find_scenes.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = picture_find_scenes.group_id
        and g.owner_id = auth.uid()
    )
  )
)
with check (
  scope = 'group'
  and group_id is not null
  and public.is_family_game_group_member(group_id)
);

-- Uploader or group admin may delete
drop policy if exists "picture_find_scenes_delete_group_manage" on public.picture_find_scenes;
create policy "picture_find_scenes_delete_group_manage"
on public.picture_find_scenes
for delete
to authenticated
using (
  scope = 'group'
  and group_id is not null
  and public.is_family_game_group_member(group_id)
  and (
    created_by = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.group_id = picture_find_scenes.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = picture_find_scenes.group_id
        and g.owner_id = auth.uid()
    )
  )
);

commit;
