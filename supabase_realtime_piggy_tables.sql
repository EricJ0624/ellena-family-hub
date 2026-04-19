-- Piggy 관련 테이블을 supabase_realtime publication 에 추가 (테이블이 실제로 있을 때만)
-- "relation does not exist" 방지: piggy 마이그레이션을 안 돌린 프로젝트에서도 스크립트 전체가 통과해야 함.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'piggy_account_requests',
    'piggy_bank_accounts',
    'piggy_wallets',
    'piggy_open_requests',
    'piggy_wallet_transactions',
    'piggy_bank_transactions'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime 이 없습니다. Supabase 기본 프로젝트가 아닐 수 있습니다.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE '건너뜀(테이블 없음): %', t;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      RAISE NOTICE '이미 publication에 포함됨: %', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    RAISE NOTICE '추가됨: %', t;
  END LOOP;
END $$;
