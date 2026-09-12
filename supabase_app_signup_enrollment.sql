-- 앱별 가입 허용/한도 + 앱 가입 동의(enrollment)
-- 인원 카운트 = user_app_enrollments (동의 완료 시점). 결제 entitlement는 별도 확장 예정.
-- 전역 auth.users 한도 트리거는 완화(계정 생성 자체는 허용, 앱 한도는 enrollment에서 적용).

CREATE TABLE IF NOT EXISTS public.app_signup_settings (
  app_id text PRIMARY KEY
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  signup_enabled boolean NOT NULL DEFAULT true,
  signup_max_users integer NULL CHECK (signup_max_users IS NULL OR signup_max_users >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_signup_settings IS
  '앱별 신규 가입/교차 동의 허용·한도. 카운트 기준은 user_app_enrollments.';

CREATE TABLE IF NOT EXISTS public.user_app_enrollments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  consented_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'signup'
    CHECK (source IN ('signup', 'cross_app_consent', 'backfill')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

COMMENT ON TABLE public.user_app_enrollments IS
  '앱별 가입 동의. 향후 결제 entitlement는 별도 테이블로 확장.';

-- 기존 전역 설정을 4앱에 복사(없으면 기본 허용·한도 없음)
INSERT INTO public.app_signup_settings (app_id, signup_enabled, signup_max_users, updated_at, updated_by)
SELECT v.app_id,
       COALESCE(s.signup_enabled, true),
       s.signup_max_users,
       COALESCE(s.updated_at, now()),
       s.updated_by
FROM (
  VALUES
    ('hearth_family'),
    ('hearth_couple'),
    ('hearth_biker'),
    ('hearth_camper')
) AS v(app_id)
LEFT JOIN public.system_settings s ON s.id = 1
ON CONFLICT (app_id) DO NOTHING;

ALTER TABLE public.app_signup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_enrollments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_signup_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.app_signup_settings FROM anon;
REVOKE ALL ON TABLE public.app_signup_settings FROM authenticated;
GRANT ALL ON TABLE public.app_signup_settings TO service_role;

REVOKE ALL ON TABLE public.user_app_enrollments FROM PUBLIC;
REVOKE ALL ON TABLE public.user_app_enrollments FROM anon;
REVOKE ALL ON TABLE public.user_app_enrollments FROM authenticated;
GRANT ALL ON TABLE public.user_app_enrollments TO service_role;
GRANT SELECT ON TABLE public.user_app_enrollments TO authenticated;

DROP POLICY IF EXISTS user_app_enrollments_select_own ON public.user_app_enrollments;
CREATE POLICY user_app_enrollments_select_own
  ON public.user_app_enrollments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_app_enrollments_app_id
  ON public.user_app_enrollments (app_id);

-- 기존 그룹 이용자 백필 (멤버십 + 소유)
INSERT INTO public.user_app_enrollments (user_id, app_id, consented_at, source)
SELECT DISTINCT m.user_id, g.app_id, now(), 'backfill'
FROM public.memberships m
INNER JOIN public.groups g ON g.id = m.group_id
WHERE g.app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')
ON CONFLICT (user_id, app_id) DO NOTHING;

INSERT INTO public.user_app_enrollments (user_id, app_id, consented_at, source)
SELECT DISTINCT g.owner_id, g.app_id, now(), 'backfill'
FROM public.groups g
WHERE g.app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')
  AND g.owner_id IS NOT NULL
ON CONFLICT (user_id, app_id) DO NOTHING;

-- 앱별 가입 가능 여부 (enrollment 수 기준)
DROP FUNCTION IF EXISTS public.get_signup_availability();
DROP FUNCTION IF EXISTS public.get_signup_availability(text);

CREATE OR REPLACE FUNCTION public.get_signup_availability(p_app_id text)
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
  IF p_app_id IS NULL OR p_app_id NOT IN (
    'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
  ) THEN
    RETURN jsonb_build_object(
      'app_id', p_app_id,
      'signup_enabled', false,
      'signup_max_users', null,
      'current_user_count', 0,
      'allowed', false,
      'reason', 'disabled'
    );
  END IF;

  SELECT s.signup_enabled, s.signup_max_users
    INTO v_enabled, v_max
  FROM public.app_signup_settings s
  WHERE s.app_id = p_app_id;
  v_settings_found := FOUND;

  SELECT count(*)::integer INTO v_count
  FROM public.user_app_enrollments e
  WHERE e.app_id = p_app_id;

  IF NOT v_settings_found THEN
    RETURN jsonb_build_object(
      'app_id', p_app_id,
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
    'app_id', p_app_id,
    'signup_enabled', v_enabled,
    'signup_max_users', v_max,
    'current_user_count', v_count,
    'allowed', v_allowed,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_signup_availability(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_signup_availability(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_signup_availability(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_signup_availability(text) TO service_role;

-- 앱 가입 동의. p_user_id NULL이면 auth.uid() 사용(교차 동의). service_role은 p_user_id 필수.
CREATE OR REPLACE FUNCTION public.enroll_user_in_app(
  p_app_id text,
  p_source text DEFAULT 'cross_app_consent',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_source text;
  v_avail jsonb;
  v_existing boolean;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_app_id IS NULL OR p_app_id NOT IN (
    'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
  ) THEN
    RAISE EXCEPTION 'invalid app_id' USING ERRCODE = 'P0001';
  END IF;

  v_source := COALESCE(NULLIF(trim(p_source), ''), 'cross_app_consent');
  IF v_source NOT IN ('signup', 'cross_app_consent', 'backfill') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = 'P0001';
  END IF;

  -- 호출자가 service_role이 아니면 본인만
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_app_enrollments e
    WHERE e.user_id = v_uid AND e.app_id = p_app_id
  ) INTO v_existing;

  IF v_existing THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_enrolled', true,
      'app_id', p_app_id,
      'user_id', v_uid
    );
  END IF;

  v_avail := public.get_signup_availability(p_app_id);
  IF COALESCE((v_avail->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'signups not allowed'
      USING ERRCODE = 'P0001',
            DETAIL = COALESCE(v_avail->>'reason', 'disabled');
  END IF;

  INSERT INTO public.user_app_enrollments (user_id, app_id, consented_at, source)
  VALUES (v_uid, p_app_id, now(), v_source);

  RETURN jsonb_build_object(
    'ok', true,
    'already_enrolled', false,
    'app_id', p_app_id,
    'user_id', v_uid,
    'source', v_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_user_in_app(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enroll_user_in_app(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.enroll_user_in_app(text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_user_in_app(text, text, uuid) TO service_role;

-- 전역 auth.users 한도 제거: 계정 생성은 허용. 앱 한도는 enrollment에서만.
CREATE OR REPLACE FUNCTION public.enforce_signup_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_signup_policy ON auth.users;
CREATE TRIGGER trg_enforce_signup_policy
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_policy();

COMMENT ON TABLE public.system_settings IS
  '레거시 전역 설정(읽기 전용 폴백). 쓰기는 app_signup_settings 사용.';
