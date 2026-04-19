-- Piggy Bank: Realtime(postgres_changes) 이벤트를 받으려면 테이블이 supabase_realtime publication에 포함되어야 함.
-- 대시보드: 멤버 요청 → 관리자 목록, 관리자 삭제/승인 → 멤버 화면 동기화에 필요.
-- Supabase SQL Editor에서 한 번 실행 (이미 있으면 건너뜀).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_account_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_account_requests;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_bank_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_bank_accounts;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_wallets;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_open_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_open_requests;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_wallet_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_wallet_transactions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piggy_bank_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_bank_transactions;
  END IF;
END $$;
