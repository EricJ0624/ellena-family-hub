-- profiles 테이블 RLS 정책 설정
-- 모든 사용자가 다른 사용자의 프로필(id, email, nickname)을 읽을 수 있도록 설정

-- 1. RLS 활성화 확인
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 삭제 (필요시)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

-- 3. 모든 사용자가 다른 사용자의 프로필을 읽을 수 있는 정책 생성
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
USING (true);

-- 4. 본인만 자신의 프로필을 수정할 수 있는 정책 (이미 있다면 건너뜀)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- 5. 확인 쿼리
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

