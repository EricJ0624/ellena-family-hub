-- profiles: 앱 표시 언어·거주 국가 (가입 시 필수, 계정 단위)
-- 적용: Supabase Dashboard SQL Editor 또는 MCP apply_migration
-- 기존 사용자(2계정): preferred_language='ko', country_code='KR' 백필

-- 1. 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);

COMMENT ON COLUMN public.profiles.preferred_language IS '앱 UI 표시 언어 (ko, en, ja, zh-CN, zh-TW, es, fr, de, it)';
COMMENT ON COLUMN public.profiles.country_code IS '거주 국가 ISO 3166-1 alpha-2';

-- 2. 기존 행 백필 (실사용 계정 소수 — 기본 ko/KR)
UPDATE public.profiles
SET
  preferred_language = COALESCE(preferred_language, 'ko'),
  country_code = UPPER(COALESCE(country_code, 'KR'))
WHERE preferred_language IS NULL OR country_code IS NULL;

-- 3. NOT NULL·기본값·검증
ALTER TABLE public.profiles
  ALTER COLUMN preferred_language SET DEFAULT 'en',
  ALTER COLUMN country_code SET DEFAULT 'KR';

ALTER TABLE public.profiles
  ALTER COLUMN preferred_language SET NOT NULL,
  ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'it'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_country_code_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_check
  CHECK (country_code ~ '^[A-Z]{2}$');

-- 4. sign up / auth.users 업데이트 시 profiles 동기화
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_lang TEXT;
  meta_country TEXT;
BEGIN
  meta_lang := NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_language'), '');
  meta_country := NULLIF(TRIM(UPPER(NEW.raw_user_meta_data->>'country_code')), '');

  INSERT INTO public.profiles (id, email, nickname, preferred_language, country_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
    COALESCE(meta_lang, 'en'),
    COALESCE(meta_country, 'KR')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', public.profiles.nickname, NEW.email),
    preferred_language = COALESCE(meta_lang, public.profiles.preferred_language, 'en'),
    country_code = COALESCE(meta_country, public.profiles.country_code, 'KR'),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_lang TEXT;
  meta_country TEXT;
BEGIN
  meta_lang := NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_language'), '');
  meta_country := NULLIF(TRIM(UPPER(NEW.raw_user_meta_data->>'country_code')), '');

  UPDATE public.profiles
  SET
    email = NEW.email,
    nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', public.profiles.nickname, NEW.email),
    preferred_language = COALESCE(meta_lang, public.profiles.preferred_language),
    country_code = COALESCE(meta_country, public.profiles.country_code),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
