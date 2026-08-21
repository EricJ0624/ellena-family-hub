-- 신규 계정 가입 on/off + 인원 한도
-- 기본값: 가입 허용, 한도 없음
-- 적용: 이 파일을 SQL Editor에서 실행하거나, 앱 배포와 함께 마이그레이션 적용

CREATE TABLE IF NOT EXISTS public.system_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signup_enabled boolean NOT NULL DEFAULT true,
  signup_max_users integer NULL CHECK (signup_max_users IS NULL OR signup_max_users >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.system_settings IS '시스템 전역 설정 (1행). signup_enabled=가입 허용, signup_max_users=현재 auth.users 한도(NULL=무제한)';

INSERT INTO public.system_settings (id, signup_enabled, signup_max_users)
VALUES (1, true, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.system_settings FROM anon;
REVOKE ALL ON TABLE public.system_settings FROM authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;

CREATE OR REPLACE FUNCTION public.get_signup_availability()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_max integer;
  v_count integer;
  v_allowed boolean;
  v_reason text;
  v_settings_found boolean;
BEGIN
  SELECT s.signup_enabled, s.signup_max_users
    INTO v_enabled, v_max
  FROM public.system_settings s
  WHERE s.id = 1;
  v_settings_found := FOUND;

  SELECT count(*)::integer INTO v_count FROM auth.users;

  IF NOT v_settings_found THEN
    RETURN jsonb_build_object(
      'signup_enabled', true,
      'signup_max_users', null,
      'current_user_count', v_count,
      'allowed', true,
      'reason', 'ok'
    );
  END IF;

  IF v_enabled IS FALSE THEN
    v_allowed := false;
    v_reason := 'disabled';
  ELSIF v_max IS NOT NULL AND v_count >= v_max THEN
    v_allowed := false;
    v_reason := 'cap_reached';
  ELSE
    v_allowed := true;
    v_reason := 'ok';
  END IF;

  RETURN jsonb_build_object(
    'signup_enabled', v_enabled,
    'signup_max_users', v_max,
    'current_user_count', v_count,
    'allowed', v_allowed,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_signup_availability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_signup_availability() FROM anon;
REVOKE ALL ON FUNCTION public.get_signup_availability() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_signup_availability() TO service_role;

-- auth.users INSERT 직전 차단. 로그인·비밀번호 재설정·이메일 인증(기존 행)은 영향 없음.
CREATE OR REPLACE FUNCTION public.enforce_signup_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_max integer;
  v_count integer;
BEGIN
  SELECT s.signup_enabled, s.signup_max_users
    INTO v_enabled, v_max
  FROM public.system_settings s
  WHERE s.id = 1;

  -- 설정 행이 없으면 가입을 열어 둔다 (fail-open)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_enabled IS FALSE THEN
    RAISE EXCEPTION 'signups not allowed' USING ERRCODE = 'P0001';
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT count(*)::integer INTO v_count FROM auth.users;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'signups not allowed' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_signup_policy ON auth.users;
CREATE TRIGGER trg_enforce_signup_policy
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_policy();

REVOKE ALL ON FUNCTION public.enforce_signup_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_signup_policy() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_signup_policy() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_signup_policy() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.enforce_signup_policy() TO postgres;
GRANT EXECUTE ON FUNCTION public.enforce_signup_policy() TO service_role;

