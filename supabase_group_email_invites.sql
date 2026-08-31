-- 그룹 관리자가 등록된 사용자 이메일로 직접 초대 (가입 플로우와 분리)
-- Supabase SQL Editor 또는 마이그레이션으로 적용

BEGIN;

CREATE TABLE IF NOT EXISTS public.group_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_email_invites_group_id
  ON public.group_email_invites (group_id);

CREATE INDEX IF NOT EXISTS idx_group_email_invites_invitee_user_id
  ON public.group_email_invites (invitee_user_id);

CREATE INDEX IF NOT EXISTS idx_group_email_invites_invitee_pending
  ON public.group_email_invites (invitee_user_id, status)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_email_invites_pending_unique
  ON public.group_email_invites (group_id, invitee_user_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.group_email_invites IS
  '그룹 관리자의 이메일 초대 (등록된 사용자만). 수락 시 memberships에 MEMBER로 추가.';

CREATE OR REPLACE FUNCTION public.update_group_email_invites_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_group_email_invites_updated_at ON public.group_email_invites;
CREATE TRIGGER update_group_email_invites_updated_at
  BEFORE UPDATE ON public.group_email_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_email_invites_updated_at_column();

ALTER TABLE public.group_email_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_email_invites FORCE ROW LEVEL SECURITY;

-- 초대받은 사용자: 본인 pending/과거 초대 조회
DROP POLICY IF EXISTS "group_email_invites_select_invitee" ON public.group_email_invites;
CREATE POLICY "group_email_invites_select_invitee" ON public.group_email_invites
  FOR SELECT
  USING (invitee_user_id = auth.uid());

-- 그룹 관리자: 해당 그룹 초대 목록 조회
DROP POLICY IF EXISTS "group_email_invites_select_admin" ON public.group_email_invites;
CREATE POLICY "group_email_invites_select_admin" ON public.group_email_invites
  FOR SELECT
  USING (public.is_admin_of_group(group_id));

-- 쓰기는 service role API / SECURITY DEFINER RPC만
REVOKE ALL ON TABLE public.group_email_invites FROM anon;
REVOKE ALL ON TABLE public.group_email_invites FROM authenticated;
GRANT SELECT ON TABLE public.group_email_invites TO authenticated;
GRANT ALL ON TABLE public.group_email_invites TO service_role;

CREATE OR REPLACE FUNCTION public.accept_group_email_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  inv public.group_email_invites%ROWTYPE;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
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

  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (current_uid, inv.group_id, 'MEMBER')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  UPDATE public.group_email_invites
  SET status = 'accepted', responded_at = NOW()
  WHERE id = inv.id;

  RETURN inv.group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_group_email_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_uid UUID;
  inv public.group_email_invites%ROWTYPE;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
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
    RETURN;
  END IF;

  UPDATE public.group_email_invites
  SET status = 'rejected', responded_at = NOW()
  WHERE id = inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_email_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_group_email_invite(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_group_email_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_group_email_invite(UUID) TO authenticated, service_role;

COMMIT;
