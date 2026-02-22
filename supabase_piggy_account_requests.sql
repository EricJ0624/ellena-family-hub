-- 저금통 생성 요청 (멤버가 관리자에게 저금통 생성을 요청)
-- Run after supabase_piggy_bank.sql

create table if not exists piggy_account_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists idx_piggy_account_requests_group on piggy_account_requests (group_id);
create index if not exists idx_piggy_account_requests_status on piggy_account_requests (group_id, status);

alter table piggy_account_requests enable row level security;

-- 멤버: 본인 요청 조회 가능
create policy "piggy_account_requests_select_own" on piggy_account_requests
  for select
  using (piggy_account_requests.user_id = auth.uid());

-- 멤버: 본인으로 pending 요청 1건만 insert (unique on group_id, user_id)
create policy "piggy_account_requests_insert_own" on piggy_account_requests
  for insert
  with check (piggy_account_requests.user_id = auth.uid());

-- 관리자: 그룹 내 요청 조회
create policy "piggy_account_requests_select_admin" on piggy_account_requests
  for select
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_account_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_account_requests.group_id
        and g.owner_id = auth.uid()
    )
  );

-- 관리자: piggy_bank_accounts 삭제 (저금통 삭제 기능). 이미 정책이 있으면 DROP 후 실행.
-- drop policy if exists piggy_accounts_delete_admin on piggy_bank_accounts;
create policy "piggy_accounts_delete_admin" on piggy_bank_accounts for delete
using (
  exists (select 1 from memberships m where m.group_id = piggy_bank_accounts.group_id and m.user_id = auth.uid() and m.role = 'ADMIN')
  or exists (select 1 from groups g where g.id = piggy_bank_accounts.group_id and g.owner_id = auth.uid())
);

-- drop policy if exists piggy_wallets_delete_admin on piggy_wallets;
create policy "piggy_wallets_delete_admin" on piggy_wallets for delete
using (
  exists (select 1 from memberships m where m.group_id = piggy_wallets.group_id and m.user_id = auth.uid() and m.role = 'ADMIN')
  or exists (select 1 from groups g where g.id = piggy_wallets.group_id and g.owner_id = auth.uid())
);

-- 관리자: 요청 상태 update (승인/거절)
create policy "piggy_account_requests_update_admin" on piggy_account_requests
  for update
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_account_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_account_requests.group_id
        and g.owner_id = auth.uid()
    )
  );
