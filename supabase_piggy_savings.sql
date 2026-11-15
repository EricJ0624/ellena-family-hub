-- Piggy savings (은행계좌): third balance per child + interest metadata
-- Run after supabase_piggy_bank.sql. Does not alter allowance/piggy open-approval flows.

create extension if not exists pgcrypto;

create table if not exists public.piggy_savings_accounts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Bank Account',
  balance integer not null default 0,
  currency text not null default 'KRW',
  annual_interest_rate_bps integer not null default 0 check (annual_interest_rate_bps >= 0 and annual_interest_rate_bps <= 100000),
  interest_day smallint not null default 1 check (interest_day >= 1 and interest_day <= 28),
  next_interest_on date not null default (current_date),
  tax_rate_bps integer not null default 0 check (tax_rate_bps >= 0 and tax_rate_bps <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.piggy_savings_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  type text not null check (type in (
    'deposit_from_wallet',
    'withdraw_to_wallet',
    'parent_deposit',
    'interest'
  )),
  memo text null,
  gross_amount integer null check (gross_amount is null or gross_amount >= 0),
  tax_amount integer null check (tax_amount is null or tax_amount >= 0),
  rate_bps_snapshot integer null,
  tax_rate_bps_snapshot integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_piggy_savings_accounts_group_user
  on public.piggy_savings_accounts (group_id, user_id);
create index if not exists idx_piggy_savings_tx_group_user
  on public.piggy_savings_transactions (group_id, user_id);
create index if not exists idx_piggy_savings_tx_created
  on public.piggy_savings_transactions (group_id, created_at desc);

-- Wallet ledger: savings transfer types
alter table public.piggy_wallet_transactions
  drop constraint if exists piggy_wallet_transactions_type_check;

alter table public.piggy_wallet_transactions
  add constraint piggy_wallet_transactions_type_check
  check (type = any (array[
    'allowance'::text,
    'spend'::text,
    'child_save'::text,
    'withdraw_to_wallet'::text,
    'deposit_to_savings'::text,
    'withdraw_from_savings'::text
  ]));

alter table public.piggy_savings_accounts enable row level security;
alter table public.piggy_savings_transactions enable row level security;

drop policy if exists "piggy_savings_select_member" on public.piggy_savings_accounts;
create policy "piggy_savings_select_member" on public.piggy_savings_accounts
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_accounts.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "piggy_savings_update_admin" on public.piggy_savings_accounts;
create policy "piggy_savings_update_admin" on public.piggy_savings_accounts
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_accounts.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "piggy_savings_insert_admin" on public.piggy_savings_accounts;
create policy "piggy_savings_insert_admin" on public.piggy_savings_accounts
  for insert
  with check (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_accounts.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "piggy_savings_delete_admin" on public.piggy_savings_accounts;
create policy "piggy_savings_delete_admin" on public.piggy_savings_accounts
  for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_accounts.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "piggy_savings_tx_select_member" on public.piggy_savings_transactions;
create policy "piggy_savings_tx_select_member" on public.piggy_savings_transactions
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = piggy_savings_transactions.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = piggy_savings_transactions.group_id
        and g.owner_id = auth.uid()
    )
  );

-- Data API grants (required for tables created after 2024-10-30)
grant select on public.piggy_savings_accounts to anon;
grant select, insert, update, delete on public.piggy_savings_accounts to authenticated;
grant select, insert, update, delete on public.piggy_savings_accounts to service_role;

grant select on public.piggy_savings_transactions to anon;
grant select, insert, update, delete on public.piggy_savings_transactions to authenticated;
grant select, insert, update, delete on public.piggy_savings_transactions to service_role;

-- Realtime publication (skip if missing)
do $$
declare
  t text;
  tables text[] := array['piggy_savings_accounts', 'piggy_savings_transactions'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime 이 없습니다.';
    return;
  end if;

  foreach t in array tables
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      continue;
    end if;
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
