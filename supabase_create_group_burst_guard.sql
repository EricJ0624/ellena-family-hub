-- create_group 연속 생성 방지 (인증 링크 재클릭·연타·병렬 탭)
-- 소유 그룹 총 개수 제한은 없음. 직전 생성 후 짧은 시간 내 추가 생성만 차단.
-- Supabase SQL Editor 또는 마이그레이션으로 적용.

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
  owned_count INTEGER;
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

  -- 동일 사용자의 create_group RPC 직렬화 (병렬 탭·연타 레이스 방지)
  PERFORM pg_advisory_xact_lock(hashtextextended(current_uid::text, 0));

  IF NOT public.is_system_admin(current_uid)
     AND public.user_has_only_suspended_groups(current_uid) THEN
    RAISE EXCEPTION 'ALL_GROUPS_SUSPENDED';
  END IF;

  SELECT count(*)::integer
  INTO owned_count
  FROM public.groups g
  WHERE g.owner_id = current_uid;

  IF NOT public.is_system_admin(current_uid) AND owned_count > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.owner_id = current_uid
        AND g.created_at > (now() - interval '15 seconds')
    ) THEN
      RAISE EXCEPTION 'GROUP_CREATE_BURST';
    END IF;
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

REVOKE ALL ON FUNCTION public.create_group(text, text, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group(text, text, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid, boolean) TO authenticated, service_role;
