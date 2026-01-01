-- auth.users에서 profiles 테이블로 자동 동기화 설정
-- 로그인 여부와 관계없이 모든 사용자가 profiles 테이블에 자동으로 생성/업데이트되도록 함

-- 1. profiles 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. auth.users에서 profiles로 자동 동기화하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', profiles.nickname, NEW.email),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. auth.users에 새 사용자가 생성될 때 profiles에 자동 추가하는 트리거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. auth.users가 업데이트될 때 profiles도 업데이트하는 함수
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', profiles.nickname, NEW.email),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. auth.users 업데이트 시 profiles 동기화 트리거
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();

-- 6. 기존 auth.users 데이터를 profiles로 마이그레이션 (한 번만 실행)
INSERT INTO public.profiles (id, email, nickname)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'nickname', email)
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  nickname = COALESCE(EXCLUDED.nickname, profiles.nickname, EXCLUDED.email),
  updated_at = NOW();

-- 7. RLS 정책 설정 (모든 사용자가 다른 사용자의 프로필을 읽을 수 있도록)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- 8. 확인 쿼리
SELECT 
  'auth.users' as source,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'profiles' as source,
  COUNT(*) as count
FROM public.profiles;

