-- Family Log cards and dashboard widget key. Existing widgets stay disabled for this key.
begin;

create table if not exists public.family_log_cards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('checkin', 'route')),
  day_date date not null,
  latitude double precision,
  longitude double precision,
  address text,
  route_points jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_log_cards_group_day
  on public.family_log_cards (group_id, day_date desc, created_at desc);

alter table public.family_log_cards enable row level security;

drop policy if exists "family_log_cards_select" on public.family_log_cards;
create policy "family_log_cards_select" on public.family_log_cards
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "family_log_cards_insert" on public.family_log_cards;
create policy "family_log_cards_insert" on public.family_log_cards
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "family_log_cards_update" on public.family_log_cards;
create policy "family_log_cards_update" on public.family_log_cards
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "family_log_cards_delete" on public.family_log_cards;
create policy "family_log_cards_delete" on public.family_log_cards
  for delete using (public.is_group_member(group_id, auth.uid()));

alter table public.widget_configs
  drop constraint if exists widget_configs_widget_key_check;

alter table public.widget_configs
  add constraint widget_configs_widget_key_check
  check (
    widget_key in (
      'tasks', 'calendar', 'chat', 'location', 'album', 'travel', 'piggy', 'games',
      'travel_diary', 'travel_quick_record', 'family_log'
    )
  );

insert into public.widget_configs (group_id, widget_key, is_enabled, display_order)
select g.id, 'family_log'::text, false, 58
from public.groups g
on conflict (group_id, widget_key) do nothing;

commit;
