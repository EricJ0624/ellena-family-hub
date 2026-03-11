-- 저금통 삭제 시 거래 내역 보관용 아카이브 테이블 (관리자만 조회)
-- Supabase SQL Editor에서 실행해 주세요.

-- 1. 삭제 이력 스냅샷 (저금통 삭제 1회당 1행)
create table if not exists piggy_deleted_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  account_name text
);

create index if not exists idx_piggy_snapshots_group on piggy_deleted_account_snapshots (group_id);
create index if not exists idx_piggy_snapshots_user on piggy_deleted_account_snapshots (user_id);
create index if not exists idx_piggy_snapshots_deleted_at on piggy_deleted_account_snapshots (deleted_at desc);

-- 2. 용돈 거래 아카이브 (원본과 동일 컬럼 + archived_at, archived_by, snapshot_id)
create table if not exists piggy_wallet_transactions_archive (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  actor_id uuid not null,
  amount integer not null check (amount > 0),
  type text not null check (type in ('allowance', 'spend', 'child_save', 'withdraw_to_wallet')),
  memo text null,
  request_id uuid null,
  created_at timestamptz not null default now(),
  archived_at timestamptz not null default now(),
  archived_by uuid,
  snapshot_id uuid not null references piggy_deleted_account_snapshots(id) on delete cascade
);

create index if not exists idx_piggy_wallet_archive_snapshot on piggy_wallet_transactions_archive (snapshot_id);
create index if not exists idx_piggy_wallet_archive_group_user on piggy_wallet_transactions_archive (group_id, user_id);

-- 3. 저금통 거래 아카이브 (원본과 동일 컬럼 + archived_at, archived_by, snapshot_id)
create table if not exists piggy_bank_transactions_archive (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  actor_id uuid not null,
  related_user_id uuid null,
  amount integer not null check (amount > 0),
  type text not null check (type in ('parent_deposit', 'child_save', 'withdraw_cash', 'withdraw_to_wallet')),
  memo text null,
  request_id uuid null,
  created_at timestamptz not null default now(),
  archived_at timestamptz not null default now(),
  archived_by uuid,
  snapshot_id uuid not null references piggy_deleted_account_snapshots(id) on delete cascade
);

create index if not exists idx_piggy_bank_archive_snapshot on piggy_bank_transactions_archive (snapshot_id);
create index if not exists idx_piggy_bank_archive_group_user on piggy_bank_transactions_archive (group_id, related_user_id);

-- 4. RLS: 시스템 관리자만 조회 가능 (API는 service role 사용으로 RLS 우회)
alter table piggy_deleted_account_snapshots enable row level security;
alter table piggy_wallet_transactions_archive enable row level security;
alter table piggy_bank_transactions_archive enable row level security;

-- INSERT/UPDATE/DELETE는 서버(service role)만 수행하므로 정책 없음.
-- SELECT: 시스템 관리자만 (is_system_admin 함수가 있으면 사용)
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'is_system_admin') then
    execute 'create policy "piggy_snapshots_select_system_admin" on piggy_deleted_account_snapshots for select using (public.is_system_admin(auth.uid()));';
    execute 'create policy "piggy_wallet_archive_select_system_admin" on piggy_wallet_transactions_archive for select using (public.is_system_admin(auth.uid()));';
    execute 'create policy "piggy_bank_archive_select_system_admin" on piggy_bank_transactions_archive for select using (public.is_system_admin(auth.uid()));';
  else
    -- is_system_admin 없으면 authenticated 사용자 중 서버만 접근하므로 deny all로 두고 API로만 접근
    execute 'create policy "piggy_snapshots_select_deny" on piggy_deleted_account_snapshots for select using (false);';
    execute 'create policy "piggy_wallet_archive_select_deny" on piggy_wallet_transactions_archive for select using (false);';
    execute 'create policy "piggy_bank_archive_select_deny" on piggy_bank_transactions_archive for select using (false);';
  end if;
exception
  when duplicate_object then null; -- 정책 이미 있으면 무시
end $$;
