-- 시스템 관리자 테이블 쓰기는 서버(service_role)만.
-- 가입 트리거 auto_add_system_admin 은 SECURITY DEFINER 이라 영향 없음.

REVOKE ALL ON TABLE public.system_admins FROM PUBLIC;
REVOKE ALL ON TABLE public.system_admins FROM anon;
REVOKE ALL ON TABLE public.system_admins FROM authenticated;
GRANT ALL ON TABLE public.system_admins TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_stepup_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fail_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_stepup_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_stepup_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_stepup_attempts FROM anon;
REVOKE ALL ON TABLE public.admin_stepup_attempts FROM authenticated;
GRANT ALL ON TABLE public.admin_stepup_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_system_admin(p_from_user_id uuid, p_to_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  successor_email text;
BEGIN
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER';
  END IF;
  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'CANNOT_TRANSFER_TO_SELF';
  END IF;
  IF NOT public.is_system_admin(p_from_user_id) THEN
    RAISE EXCEPTION 'NOT_SYSTEM_ADMIN';
  END IF;
  IF public.is_system_admin(p_to_user_id) THEN
    RAISE EXCEPTION 'ALREADY_SYSTEM_ADMIN';
  END IF;

  SELECT p.email INTO successor_email
  FROM public.profiles p
  WHERE p.id = p_to_user_id;

  IF successor_email IS NULL OR btrim(successor_email) = '' THEN
    RAISE EXCEPTION 'SUCCESSOR_NOT_FOUND';
  END IF;

  INSERT INTO public.system_admins (user_id, email, created_by, is_active)
  VALUES (p_to_user_id, successor_email, p_from_user_id, true);

  DELETE FROM public.system_admins
  WHERE user_id = p_from_user_id;

  IF public.is_system_admin(p_from_user_id) OR NOT public.is_system_admin(p_to_user_id) THEN
    RAISE EXCEPTION 'TRANSFER_FAILED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_system_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_system_admin(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.transfer_system_admin(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_system_admin(uuid, uuid) TO service_role;

-- 기존 승격 RPC는 이양 우회가 되므로 클라이언트에서 호출하지 못하게 한다.
REVOKE ALL ON FUNCTION public.add_system_admin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_system_admin(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.add_system_admin(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_system_admin(uuid, text) TO service_role;
