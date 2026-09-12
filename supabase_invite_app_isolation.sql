-- 초대코드 합류·이메일 초대 수락을 앱(app_id) 단위로 격리
-- 호출부는 CURRENT_APP_ID를 p_app_id로 전달해야 함.

-- 1) join_group_by_invite_code: 기존 1인자 제거 후 2인자로 교체
DROP FUNCTION IF EXISTS public.join_group_by_invite_code(text);

CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(
  invite_code_param text,
  p_app_id text
)
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

  IF p_app_id IS NULL OR p_app_id NOT IN (
    'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
  ) THEN
    RAISE EXCEPTION 'Invalid app_id';
  END IF;

  IF NOT public.is_invite_code_valid(invite_code_param) THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;

  SELECT id INTO target_group_id
  FROM public.groups
  WHERE invite_code = invite_code_param
    AND app_id = p_app_id;

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

  INSERT INTO public.memberships (user_id, group_id, role, app_id)
  VALUES (current_uid, target_group_id, 'MEMBER', p_app_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN target_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_by_invite_code(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_group_by_invite_code(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(text, text) TO authenticated, service_role;

-- 2) accept_group_email_invite: 해당 앱 그룹 초대만 수락
DROP FUNCTION IF EXISTS public.accept_group_email_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_group_email_invite(
  p_invite_id uuid,
  p_app_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  inv public.group_email_invites%ROWTYPE;
  v_group_app text;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF p_app_id IS NULL OR p_app_id NOT IN (
    'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'
  ) THEN
    RAISE EXCEPTION 'Invalid app_id';
  END IF;

  SELECT * INTO inv
  FROM public.group_email_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF inv.invitee_user_id <> current_uid THEN
    RAISE EXCEPTION 'Not authorized for this invite';
  END IF;

  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;

  IF inv.expires_at <= NOW() THEN
    UPDATE public.group_email_invites
    SET status = 'expired', responded_at = NOW()
    WHERE id = inv.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  SELECT g.app_id INTO v_group_app
  FROM public.groups g
  WHERE g.id = inv.group_id;

  IF v_group_app IS NULL OR v_group_app IS DISTINCT FROM p_app_id THEN
    RAISE EXCEPTION 'Invite not available in this app';
  END IF;

  IF NOT public.is_system_admin(current_uid)
     AND public.is_group_suspended(inv.group_id) THEN
    RAISE EXCEPTION 'GROUP_SUSPENDED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = current_uid AND group_id = inv.group_id
  ) THEN
    UPDATE public.group_email_invites
    SET status = 'accepted', responded_at = NOW()
    WHERE id = inv.id;
    RETURN inv.group_id;
  END IF;

  INSERT INTO public.memberships (user_id, group_id, role, app_id)
  VALUES (current_uid, inv.group_id, 'MEMBER', p_app_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  UPDATE public.group_email_invites
  SET status = 'accepted', responded_at = NOW()
  WHERE id = inv.id;

  RETURN inv.group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_email_invite(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_group_email_invite(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_group_email_invite(uuid, text) TO authenticated, service_role;
