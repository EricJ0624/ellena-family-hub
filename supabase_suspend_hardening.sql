-- 정지 가드: 시스템 관리자 예외, 전부 정지 시 그룹 생성 불가, 정지 그룹 가입 불가
-- anon 권한 회수 (문의 테이블 SELECT만)

CREATE OR REPLACE FUNCTION public.is_user_suspended_in_group(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_system_admin(p_user_id) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.account_suspensions s
      WHERE s.is_active
        AND s.group_id = p_group_id
        AND (
          (s.scope = 'group')
          OR (s.scope = 'user_in_group' AND s.user_id = p_user_id)
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_only_suspended_groups(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owned AS (
    SELECT g.id
    FROM public.groups g
    WHERE g.owner_id = p_user_id
  ),
  member_of AS (
    SELECT m.group_id AS id
    FROM public.memberships m
    WHERE m.user_id = p_user_id
  ),
  all_groups AS (
    SELECT id FROM owned
    UNION
    SELECT id FROM member_of
  )
  SELECT EXISTS (SELECT 1 FROM all_groups)
    AND NOT EXISTS (
      SELECT 1
      FROM all_groups ag
      WHERE NOT public.is_user_suspended_in_group(p_user_id, ag.id)
    );
$$;

CREATE OR REPLACE FUNCTION public.create_group(
  group_name text,
  invite_code_param text,
  owner_id_param uuid DEFAULT NULL,
  display_name_pending_param boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  new_group_id UUID;
  current_uid UUID;
  final_owner_id UUID;
  final_name TEXT;
  final_pending BOOLEAN;
BEGIN
  current_uid := auth.uid();

  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF owner_id_param IS NOT NULL THEN
    IF owner_id_param != current_uid THEN
      RAISE EXCEPTION 'owner_id must match authenticated user';
    END IF;
    final_owner_id := owner_id_param;
  ELSE
    final_owner_id := current_uid;
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.user_has_only_suspended_groups(current_uid) THEN
    RAISE EXCEPTION 'ALL_GROUPS_SUSPENDED';
  END IF;

  final_pending := COALESCE(display_name_pending_param, false);

  IF final_pending THEN
    final_name := '__display_name_pending__';
  ELSE
    final_name := NULLIF(trim(group_name), '');
    IF final_name IS NULL THEN
      RAISE EXCEPTION 'group_name is required when display_name_pending is false';
    END IF;
  END IF;

  INSERT INTO public.groups (name, invite_code, owner_id, display_name_pending)
  VALUES (final_name, invite_code_param, final_owner_id, final_pending)
  RETURNING id INTO new_group_id;

  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (final_owner_id, new_group_id, 'ADMIN')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN new_group_id;
END;
$$;

-- 2인자 오버로드도 본체로 위임해 전부 정지 시 생성 우회를 막는다.
CREATE OR REPLACE FUNCTION public.create_group(group_name text, invite_code_param text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.create_group(group_name, invite_code_param, NULL, false);
$$;

REVOKE ALL ON FUNCTION public.create_group(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(invite_code_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_group_id UUID;
  current_uid UUID;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF NOT public.is_invite_code_valid(invite_code_param) THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;

  SELECT id INTO target_group_id
  FROM public.groups
  WHERE invite_code = invite_code_param;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.is_group_suspended(target_group_id) THEN
    RAISE EXCEPTION 'GROUP_SUSPENDED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = current_uid
      AND group_id = target_group_id
  ) THEN
    RAISE EXCEPTION 'Already a member of this group';
  END IF;

  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (current_uid, target_group_id, 'MEMBER')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN target_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_group_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_suspended(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_group_suspended(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.user_has_only_suspended_groups(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_only_suspended_groups(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_only_suspended_groups(uuid) TO authenticated, service_role;

REVOKE ALL ON TABLE public.moderation_threads FROM anon;
REVOKE ALL ON TABLE public.moderation_messages FROM anon;
REVOKE ALL ON TABLE public.account_suspensions FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.moderation_threads FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.moderation_messages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.account_suspensions FROM authenticated;

GRANT SELECT ON TABLE public.moderation_threads TO authenticated;
GRANT SELECT ON TABLE public.moderation_messages TO authenticated;
GRANT SELECT ON TABLE public.account_suspensions TO authenticated;

GRANT ALL ON TABLE public.moderation_threads TO service_role;
GRANT ALL ON TABLE public.moderation_messages TO service_role;
GRANT ALL ON TABLE public.account_suspensions TO service_role;
