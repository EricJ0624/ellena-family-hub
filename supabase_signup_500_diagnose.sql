-- Sign up 500 원인 진단 (Supabase SQL Editor에서 실행)
-- 결과로 테이블/함수 소유자, RLS 여부, profiles 정책을 확인

-- 1) profiles 테이블: RLS 여부, 소유자, FORCE ROW LEVEL SECURITY
SELECT
  'profiles table' AS check_type,
  c.relname AS name,
  pg_catalog.pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'profiles';

-- 2) handle_new_user 함수 소유자 (트리거가 이 역할로 INSERT 시도)
SELECT
  'handle_new_user owner' AS check_type,
  p.proname AS name,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';

-- 3) profiles 테이블 정책 목록 (INSERT 정책 있는지 확인)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS command,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
