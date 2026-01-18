-- Ellena Piggy Bank: wallets + piggy bank + approvals
-- Keep logic isolated; no existing tables modified.

create extension if not exists pgcrypto;

create table if not exists piggy_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null default 'Ellena Piggy Bank',
  balance integer not null default 0,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id)
);

create table if not exists piggy_wallets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists piggy_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  type text not null check (type in ('allowance', 'spend', 'child_save', 'withdraw_to_wallet')),
  memo text null,
  request_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists piggy_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  related_user_id uuid null references profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  type text not null check (type in ('parent_deposit', 'child_save', 'withdraw_cash', 'withdraw_to_wallet')),
  memo text null,
  request_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists piggy_open_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  child_id uuid not null references profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text null,
  destination text not null check (destination in ('wallet', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create table if not exists piggy_open_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references piggy_open_requests(id) on delete cascade,
  approver_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  approved_at timestamptz not null default now(),
  unique (request_id, role)
);

create index if not exists idx_piggy_wallets_group_user on piggy_wallets (group_id, user_id);
create index if not exists idx_piggy_wallet_tx_group_user on piggy_wallet_transactions (group_id, user_id);
create index if not exists idx_piggy_bank_tx_group on piggy_bank_transactions (group_id);
create index if not exists idx_piggy_open_requests_group on piggy_open_requests (group_id);
create index if not exists idx_piggy_open_approvals_request on piggy_open_approvals (request_id);

alter table piggy_bank_accounts enable row level security;
alter table piggy_wallets enable row level security;
alter table piggy_wallet_transactions enable row level security;
alter table piggy_bank_transactions enable row level security;
alter table piggy_open_requests enable row level security;
alter table piggy_open_approvals enable row level security;

-- Helper predicate: group member or owner
create policy "piggy_accounts_select_member" on piggy_bank_accounts
  for select
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_bank_accounts.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_bank_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_accounts_update_admin" on piggy_bank_accounts
  for update
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_bank_accounts.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_bank_accounts.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_wallets_select_member" on piggy_wallets
  for select
  using (
    piggy_wallets.user_id = auth.uid()
    or exists (
      select 1 from memberships m
      where m.group_id = piggy_wallets.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_wallets.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_wallets_update_admin" on piggy_wallets
  for update
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_wallets.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_wallets.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_wallet_tx_select_member" on piggy_wallet_transactions
  for select
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_wallet_transactions.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_wallet_transactions.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_bank_tx_select_member" on piggy_bank_transactions
  for select
  using (
    exists (
      select 1 from memberships m
      where m.group_id = piggy_bank_transactions.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_bank_transactions.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_open_requests_select_member" on piggy_open_requests
  for select
  using (
    piggy_open_requests.child_id = auth.uid()
    or exists (
      select 1 from memberships m
      where m.group_id = piggy_open_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_open_requests.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_open_requests_insert_self" on piggy_open_requests
  for insert
  with check (
    piggy_open_requests.child_id = auth.uid()
  );

create policy "piggy_open_requests_update_member" on piggy_open_requests
  for update
  using (
    piggy_open_requests.child_id = auth.uid()
    or exists (
      select 1 from memberships m
      where m.group_id = piggy_open_requests.group_id
        and m.user_id = auth.uid()
        and m.role = 'ADMIN'
    )
    or exists (
      select 1 from groups g
      where g.id = piggy_open_requests.group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "piggy_open_approvals_select_member" on piggy_open_approvals
  for select
  using (
    exists (
      select 1 from piggy_open_requests r
      where r.id = piggy_open_approvals.request_id
        and (
          r.child_id = auth.uid()
          or exists (
            select 1 from memberships m
            where m.group_id = r.group_id
              and m.user_id = auth.uid()
              and m.role = 'ADMIN'
          )
          or exists (
            select 1 from groups g
            where g.id = r.group_id
              and g.owner_id = auth.uid()
          )
        )
    )
  );

create policy "piggy_open_approvals_insert_member" on piggy_open_approvals
  for insert
  with check (
    piggy_open_approvals.approver_id = auth.uid()
  );
