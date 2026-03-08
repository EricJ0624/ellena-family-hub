-- Sign up 500 오류 수정: auth.users 트리거 함수에 search_path 설정
-- 원인: supabase_auth_admin 역할로 트리거가 실행될 때 search_path 미설정으로
--      public 스키마 접근 실패(42P01/42501) → 500 발생
-- 적용: Supabase Dashboard → SQL Editor에서 이 스크립트 전체 실행

-- 1. handle_new_user (sign up 시 profiles INSERT)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', public.profiles.nickname, NEW.email),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. handle_user_update (auth.users 업데이트 시 profiles 동기화)
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', public.profiles.nickname, NEW.email),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 3. auto_add_system_admin (특정 이메일 시 system_admins INSERT)
-- 참고: 기존 함수가 있으면 교체, 없으면 생성됨
CREATE OR REPLACE FUNCTION public.auto_add_system_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['soungtak@icloud.com'];
  user_email TEXT;
BEGIN
  user_email := NEW.email;
  IF user_email = ANY(admin_emails) THEN
    INSERT INTO public.system_admins (user_id, email, is_active)
    VALUES (NEW.id, user_email, TRUE)
    ON CONFLICT (user_id) DO UPDATE SET
      is_active = TRUE,
      email = user_email;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거는 이미 존재하므로 함수만 교체하면 됨 (트리거 재생성 불필요)
-- 검증: 아래 쿼리로 함수에 search_path가 설정되었는지 확인
-- SELECT proname, proconfig FROM pg_proc WHERE proname IN ('handle_new_user','handle_user_update','auto_add_system_admin');
