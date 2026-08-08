-- Picture Find: system + group scene backgrounds (Phase 1: system scenes)
begin;

create table if not exists public.picture_find_scenes (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('system', 'group')),
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  image_url text not null,
  variant_image_url text,
  diff_mode text not null default 'auto' check (diff_mode in ('auto', 'manual')),
  supports_hidden boolean not null default true,
  supports_spot_diff boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint picture_find_scenes_scope_group check (
    (scope = 'system' and group_id is null)
    or (scope = 'group' and group_id is not null)
  )
);

create index if not exists idx_picture_find_scenes_system_active
  on public.picture_find_scenes (scope, is_active, sort_order)
  where scope = 'system';

create index if not exists idx_picture_find_scenes_group_active
  on public.picture_find_scenes (group_id, is_active, sort_order)
  where scope = 'group';

create or replace function public.update_picture_find_scenes_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_picture_find_scenes_updated_at on public.picture_find_scenes;
create trigger trg_picture_find_scenes_updated_at
before update on public.picture_find_scenes
for each row
execute function public.update_picture_find_scenes_updated_at();

alter table public.picture_find_scenes enable row level security;

drop policy if exists "picture_find_scenes_select_active" on public.picture_find_scenes;
create policy "picture_find_scenes_select_active"
on public.picture_find_scenes
for select
to authenticated
using (
  is_active = true
  and (
    scope = 'system'
    or (
      scope = 'group'
      and group_id is not null
      and public.is_family_game_group_member(group_id)
    )
  )
);

-- Writes via service role (admin API) only for Phase 1

insert into public.picture_find_scenes (
  scope, title, image_url, diff_mode, supports_hidden, supports_spot_diff, sort_order, is_active
)
select
  'system',
  v.title,
  v.image_url,
  'auto',
  true,
  true,
  v.sort_order,
  true
from (
  values
    ('공원', '/picture-find/scene-01.svg', 1),
    ('거실', '/picture-find/scene-02.svg', 2),
    ('주방', '/picture-find/scene-03.svg', 3),
    ('아이 방', '/picture-find/scene-04.svg', 4),
    ('해변', '/picture-find/scene-05.svg', 5),
    ('마트', '/picture-find/scene-06.svg', 6),
    ('정원', '/picture-find/scene-07.svg', 7),
    ('놀이터', '/picture-find/scene-08.svg', 8),
    ('카페', '/picture-find/scene-09.svg', 9),
    ('도서관', '/picture-find/scene-10.svg', 10)
) as v(title, image_url, sort_order)
where not exists (
  select 1 from public.picture_find_scenes s where s.scope = 'system'
);

commit;
