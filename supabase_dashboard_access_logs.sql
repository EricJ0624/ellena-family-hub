-- 대시보드 입장 기록과, 승인된 요청이 있을 때만 그룹 데이터를 읽는 권한.
-- 적용됨: create_dashboard_access_logs

CREATE TABLE IF NOT EXISTS public.dashboard_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_id UUID REFERENCES public.dashboard_access_requests(id) ON DELETE SET NULL,
  system_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  session_duration_seconds INTEGER,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_system_admin_id ON public.dashboard_access_logs(system_admin_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_group_id ON public.dashboard_access_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_accessed_at ON public.dashboard_access_logs(accessed_at DESC);

ALTER TABLE public.dashboard_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "접근 로그 읽기 - 시스템 관리자" ON public.dashboard_access_logs;
CREATE POLICY "접근 로그 읽기 - 시스템 관리자" ON public.dashboard_access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "접근 로그 작성 - 시스템 관리자" ON public.dashboard_access_logs;
CREATE POLICY "접근 로그 작성 - 시스템 관리자" ON public.dashboard_access_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.has_active_dashboard_grant(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_admins sa
    WHERE sa.user_id = user_id_param
      AND sa.is_active = true
  )
  AND EXISTS (
    SELECT 1
    FROM public.dashboard_access_requests r
    WHERE r.group_id = group_id_param
      AND r.status = 'approved'
      AND r.revoked_at IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.requested_by = user_id_param OR r.approved_by = user_id_param)
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_dashboard_grant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_dashboard_grant(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_group_member(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN public.has_active_dashboard_grant(group_id_param, user_id_param);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = user_id_param
    AND role = 'ADMIN'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN public.has_active_dashboard_grant(group_id_param, user_id_param);
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_group_dashboard(group_id_param uuid, admin_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
  SELECT public.is_group_member(group_id_param, admin_id_param);
$$;
