-- profiles 테이블 INSERT 허용 정책 (Sign up 500 해결용)
-- 원인: RLS가 켜져 있는데 INSERT 정책이 없어서, handle_new_user 트리거가
--      profiles에 INSERT 할 때 "row-level security policy" 위반으로 500 발생
-- 적용: Supabase Dashboard → SQL Editor에서 실행

-- 기존 INSERT 정책이 있으면 제거 후 재생성 (이름이 다를 수 있음)
DROP POLICY IF EXISTS "Enable insert for new users" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile insert for trigger and own" ON public.profiles;
DROP POLICY IF EXISTS "프로필 작성" ON public.profiles;

-- 트리거(handle_new_user) + 앱에서 본인 프로필 upsert 모두 허용
-- - current_user = 'postgres': 트리거가 postgres로 실행될 때 INSERT 허용
-- - auth.uid() = id: 로그인 사용자가 자기 id로만 INSERT (앱에서 upsert 시)
-- 소유자가 postgres가 아니면 supabase_signup_500_diagnose.sql 로 확인 후
-- 아래 current_user 조건에 실제 owner 이름을 넣어 주세요.
CREATE POLICY "Allow profile insert for trigger and own"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
  OR current_user = 'postgres'
);

-- 확인: profiles 정책 목록
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';
