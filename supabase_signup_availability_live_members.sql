-- 가입 한도 카운트를 현재 앱 사용자(그룹 소유자·멤버)로 맞춘다.
-- user_app_enrollments 행은 유지한다. 그룹이 없는 동의만으로는 한도에 잡히지 않는다.

COMMENT ON TABLE public.app_signup_settings IS
  '앱별 신규 가입/교차 동의 허용·한도. 카운트 기준은 현재 그룹 소유자·멤버.';

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
  FROM (
    SELECT g.owner_id AS user_id
    FROM public.groups g
    WHERE g.app_id = p_app_id
      AND g.owner_id IS NOT NULL
    UNION
    SELECT m.user_id
    FROM public.memberships m
    INNER JOIN public.groups g ON g.id = m.group_id
    WHERE m.user_id IS NOT NULL
      AND COALESCE(NULLIF(btrim(m.app_id), ''), g.app_id) = p_app_id
  ) live_users;

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
