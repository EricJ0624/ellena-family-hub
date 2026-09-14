-- 관리자 승인형 4자리 숫자 초대 코드
-- - 그룹당 active 1개 (새 코드 생성 시 기존 active 폐기)
-- - 동일 코드로 다인 가입 요청 가능
-- - 가입은 즉시 membership 삽입이 아니라 pending → admin approve
-- - 4자리 공간 보안: 인증 필수, app_id 격리, 시도 rate limit, 일반 오류 메시지

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 단기 초대 코드
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_short_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  code TEXT NOT NULL
    CHECK (code ~ '^\d{4}$'),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_short_invite_codes_one_active_per_group
  ON public.group_short_invite_codes (group_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_short_invite_codes_active_code_per_app
  ON public.group_short_invite_codes (app_id, code)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_group_short_invite_codes_lookup
  ON public.group_short_invite_codes (app_id, code, status, expires_at);

COMMENT ON TABLE public.group_short_invite_codes IS
  '관리자 입력형 4자리 초대 코드. 그룹당 active 1개, 24시간 TTL, 가입 시 관리자 승인 필요.';

-- ---------------------------------------------------------------------------
-- 2) 가입 요청 (승인 대기)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  short_code_id UUID NOT NULL REFERENCES public.group_short_invite_codes(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_join_requests_pending_unique
  ON public.group_join_requests (group_id, requester_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_group_join_requests_group_pending
  ON public.group_join_requests (group_id, status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_group_join_requests_requester
  ON public.group_join_requests (requester_user_id, status);

COMMENT ON TABLE public.group_join_requests IS
  '4자리 초대 코드로 신청한 그룹 가입 요청. 관리자 승인 시에만 membership 생성.';

-- ---------------------------------------------------------------------------
-- 3) 시도 로그 (rate limit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_short_invite_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  code_attempt TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_short_invite_attempts_user_time
  ON public.group_short_invite_attempts (user_id, created_at DESC);

COMMENT ON TABLE public.group_short_invite_attempts IS
  '4자리 초대 코드 입력 시도 로그 (brute-force 완화).';

-- ---------------------------------------------------------------------------
-- 4) RLS: 직접 접근 차단, RPC/service_role만
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_short_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_short_invite_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.group_short_invite_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_short_invite_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.group_short_invite_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.group_join_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.group_short_invite_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.group_short_invite_codes TO service_role;
GRANT ALL ON TABLE public.group_join_requests TO service_role;
GRANT ALL ON TABLE public.group_short_invite_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.group_short_invite_attempts_id_seq TO service_role;

-- 평문 코드: authenticated SELECT 정책 없음 (RPC/service_role만)
DROP POLICY IF EXISTS "short_invite_codes_select_admin" ON public.group_short_invite_codes;

-- 관리자: pending 요청 조회 / 본인 요청 조회
DROP POLICY IF EXISTS "join_requests_select_admin_or_self" ON public.group_join_requests;
CREATE POLICY "join_requests_select_admin_or_self" ON public.group_join_requests
  FOR SELECT
  USING (
    requester_user_id = auth.uid()
    OR public.is_admin_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.owner_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.group_join_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) 헬퍼: 앱 id 검증
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_valid_app_id(p_app_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_app_id IS NULL OR p_app_id NOT IN (
    'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
  ) THEN
    RAISE EXCEPTION 'Invalid app_id';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) 코드 등록 (ADMIN/owner만, 관리자 입력 4자리, 기존 active 폐기, 24h)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_group_short_invite_code(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_active_group_short_invite_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.create_group_short_invite_code(
  p_group_id UUID,
  p_app_id TEXT,
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  v_group_app TEXT;
  v_owner UUID;
  normalized TEXT;
  row_rec public.group_short_invite_codes%ROWTYPE;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  PERFORM public.assert_valid_app_id(p_app_id);

  normalized := trim(p_code);
  IF normalized !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Invalid short invite code';
  END IF;

  SELECT g.app_id, g.owner_id INTO v_group_app, v_owner
  FROM public.groups g
  WHERE g.id = p_group_id
  FOR UPDATE;

  IF v_group_app IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group_app <> p_app_id THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF NOT (
    public.is_admin_of_group(p_group_id)
    OR v_owner = current_uid
    OR public.is_system_admin(current_uid)
  ) THEN
    RAISE EXCEPTION 'Only ADMIN can create short invite code';
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.is_group_suspended(p_group_id) THEN
    RAISE EXCEPTION 'GROUP_SUSPENDED';
  END IF;

  UPDATE public.group_short_invite_codes
  SET status = 'expired'
  WHERE app_id = p_app_id
    AND code = normalized
    AND status = 'active'
    AND expires_at <= NOW();

  IF EXISTS (
    SELECT 1
    FROM public.group_short_invite_codes c
    WHERE c.app_id = p_app_id
      AND c.code = normalized
      AND c.status = 'active'
      AND c.expires_at > NOW()
      AND c.group_id <> p_group_id
  ) THEN
    RAISE EXCEPTION 'Short invite code already in use';
  END IF;

  UPDATE public.group_short_invite_codes
  SET status = 'revoked', revoked_at = NOW()
  WHERE group_id = p_group_id
    AND status = 'active';

  UPDATE public.group_join_requests
  SET status = 'cancelled', resolved_at = NOW(), resolved_by = current_uid
  WHERE group_id = p_group_id
    AND status = 'pending';

  INSERT INTO public.group_short_invite_codes (
    group_id, app_id, code, status, created_by, expires_at
  )
  VALUES (
    p_group_id, p_app_id, normalized, 'active', current_uid, NOW() + INTERVAL '24 hours'
  )
  RETURNING * INTO row_rec;

  -- 평문 코드는 응답에 포함하지 않음 (관리자가 이미 입력한 값)
  RETURN json_build_object(
    'id', row_rec.id,
    'expires_at', row_rec.expires_at,
    'group_id', row_rec.group_id,
    'status', 'created'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_short_invite_code(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group_short_invite_code(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group_short_invite_code(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) 가입 요청 (인증 사용자, rate limit, 즉시 멤버십 X)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_join_by_short_invite_code(
  p_code TEXT,
  p_app_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  normalized TEXT;
  fail_count INT;
  code_rec public.group_short_invite_codes%ROWTYPE;
  req_id UUID;
  gname TEXT;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  PERFORM public.assert_valid_app_id(p_app_id);

  normalized := trim(p_code);
  IF normalized !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- rate limit: 15분 내 실패 5회 / 1시간 내 시도 20회
  SELECT COUNT(*)::INT INTO fail_count
  FROM public.group_short_invite_attempts a
  WHERE a.user_id = current_uid
    AND a.success = FALSE
    AND a.created_at > NOW() - INTERVAL '15 minutes';

  IF fail_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later';
  END IF;

  SELECT COUNT(*)::INT INTO fail_count
  FROM public.group_short_invite_attempts a
  WHERE a.user_id = current_uid
    AND a.created_at > NOW() - INTERVAL '1 hour';

  IF fail_count >= 20 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later';
  END IF;

  -- 만료 active 정리 (해당 앱 코드만)
  UPDATE public.group_short_invite_codes
  SET status = 'expired'
  WHERE app_id = p_app_id
    AND code = normalized
    AND status = 'active'
    AND expires_at <= NOW();

  SELECT * INTO code_rec
  FROM public.group_short_invite_codes
  WHERE app_id = p_app_id
    AND code = normalized
    AND status = 'active'
    AND expires_at > NOW()
  LIMIT 1;

  IF code_rec.id IS NULL THEN
    INSERT INTO public.group_short_invite_attempts (user_id, app_id, code_attempt, success)
    VALUES (current_uid, p_app_id, normalized, FALSE);
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.is_group_suspended(code_rec.group_id) THEN
    INSERT INTO public.group_short_invite_attempts (user_id, app_id, code_attempt, success)
    VALUES (current_uid, p_app_id, normalized, FALSE);
    RAISE EXCEPTION 'GROUP_SUSPENDED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = current_uid AND m.group_id = code_rec.group_id
  ) THEN
    INSERT INTO public.group_short_invite_attempts (user_id, app_id, code_attempt, success)
    VALUES (current_uid, p_app_id, normalized, TRUE);
    RAISE EXCEPTION 'Already a member of this group';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_join_requests r
    WHERE r.group_id = code_rec.group_id
      AND r.requester_user_id = current_uid
      AND r.status = 'pending'
  ) THEN
    INSERT INTO public.group_short_invite_attempts (user_id, app_id, code_attempt, success)
    VALUES (current_uid, p_app_id, normalized, TRUE);
    RAISE EXCEPTION 'Join request already pending';
  END IF;

  INSERT INTO public.group_join_requests (
    group_id, app_id, short_code_id, requester_user_id, status
  )
  VALUES (
    code_rec.group_id, p_app_id, code_rec.id, current_uid, 'pending'
  )
  RETURNING id INTO req_id;

  INSERT INTO public.group_short_invite_attempts (user_id, app_id, code_attempt, success)
  VALUES (current_uid, p_app_id, normalized, TRUE);

  SELECT COALESCE(NULLIF(g.family_name, ''), g.name) INTO gname
  FROM public.groups g
  WHERE g.id = code_rec.group_id;

  RETURN json_build_object(
    'request_id', req_id,
    'group_id', code_rec.group_id,
    'group_name', gname,
    'status', 'pending_approval'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_join_by_short_invite_code(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_join_by_short_invite_code(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_join_by_short_invite_code(TEXT, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9) 승인 → MEMBER 삽입
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_group_join_request(
  p_request_id UUID,
  p_app_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  req public.group_join_requests%ROWTYPE;
  v_owner UUID;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  PERFORM public.assert_valid_app_id(p_app_id);

  SELECT * INTO req
  FROM public.group_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF req.app_id <> p_app_id THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  SELECT g.owner_id INTO v_owner
  FROM public.groups g
  WHERE g.id = req.group_id;

  IF NOT (
    public.is_admin_of_group(req.group_id)
    OR v_owner = current_uid
    OR public.is_system_admin(current_uid)
  ) THEN
    RAISE EXCEPTION 'Only ADMIN can approve join requests';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Join request is no longer pending';
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.is_group_suspended(req.group_id) THEN
    RAISE EXCEPTION 'GROUP_SUSPENDED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = req.requester_user_id AND m.group_id = req.group_id
  ) THEN
    UPDATE public.group_join_requests
    SET status = 'approved', resolved_at = NOW(), resolved_by = current_uid
    WHERE id = req.id;
    RETURN req.group_id;
  END IF;

  INSERT INTO public.memberships (user_id, group_id, role, app_id)
  VALUES (req.requester_user_id, req.group_id, 'MEMBER', p_app_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  UPDATE public.group_join_requests
  SET status = 'approved', resolved_at = NOW(), resolved_by = current_uid
  WHERE id = req.id;

  RETURN req.group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_group_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_group_join_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_group_join_request(UUID, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10) 거절
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_group_join_request(
  p_request_id UUID,
  p_app_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  req public.group_join_requests%ROWTYPE;
  v_owner UUID;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  PERFORM public.assert_valid_app_id(p_app_id);

  SELECT * INTO req
  FROM public.group_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF req.app_id <> p_app_id THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  SELECT g.owner_id INTO v_owner
  FROM public.groups g
  WHERE g.id = req.group_id;

  IF NOT (
    public.is_admin_of_group(req.group_id)
    OR v_owner = current_uid
    OR public.is_system_admin(current_uid)
  ) THEN
    RAISE EXCEPTION 'Only ADMIN can reject join requests';
  END IF;

  IF req.status <> 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.group_join_requests
  SET status = 'rejected', resolved_at = NOW(), resolved_by = current_uid
  WHERE id = req.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_group_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_group_join_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_group_join_request(UUID, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11) 알림 preferences widget_key에 group 추가
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_widget_key_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_widget_key_check
  CHECK (widget_key = ANY (ARRAY[
    'tasks'::text,
    'calendar'::text,
    'chat'::text,
    'location'::text,
    'travel'::text,
    'piggy'::text,
    'games'::text,
    'group'::text
  ]));

COMMIT;
