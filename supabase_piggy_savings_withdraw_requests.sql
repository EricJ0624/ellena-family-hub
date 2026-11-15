-- Bank → allowance withdraw requests (request + admin approve), parallel to piggy_open_requests.
-- Does not change piggy_open_requests / allowance / piggy open-approval behavior.

create extension if not exists pgcrypto;

create table if not exists public.piggy_savings_withdraw_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references public.profiles(id) on delete set null
);

create index if not exists idx_piggy_savings_withdraw_req_group
  on public.piggy_savings_withdraw_requests (group_id, status, created_at desc);
create index if not exists idx_piggy_savings_withdraw_req_child
  on public.piggy_savings_withdraw_requests (group_id, child_id);

alter table public.piggy_savings_transactions
  add column if not exists request_id uuid null
    references public.piggy_savings_withdraw_requests(id) on delete set null;

alter table public.piggy_savings_withdraw_requests enable row level security;

drop policy if exists "piggy_savings_withdraw_req_select" on public.piggy_savings_withdraw_requests;
create policy "piggy_savings_withdraw_req_select" on public.piggy_savings_withdraw_requests
  for select
  using (
    piggy_savings_withdraw_requests.child_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_withdraw_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_withdraw_requests.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "piggy_savings_withdraw_req_insert_self" on public.piggy_savings_withdraw_requests;
create policy "piggy_savings_withdraw_req_insert_self" on public.piggy_savings_withdraw_requests
  for insert
  with check (piggy_savings_withdraw_requests.child_id = auth.uid());

drop policy if exists "piggy_savings_withdraw_req_update_admin" on public.piggy_savings_withdraw_requests;
create policy "piggy_savings_withdraw_req_update_admin" on public.piggy_savings_withdraw_requests
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_withdraw_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_withdraw_requests.group_id
        and g.owner_id = auth.uid()
    )
  );

grant select on public.piggy_savings_withdraw_requests to anon;
grant select, insert, update, delete on public.piggy_savings_withdraw_requests to authenticated;
grant select, insert, update, delete on public.piggy_savings_withdraw_requests to service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  if to_regclass('public.piggy_savings_withdraw_requests') is null then
    return;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'piggy_savings_withdraw_requests'
  ) then
    return;
  end if;
  execute 'alter publication supabase_realtime add table public.piggy_savings_withdraw_requests';
end $$;
