-- Phase C: groups.app_id (hearth_family 고정 + Couple 준비)
-- 기존 행은 DEFAULT로 백필. 가입/로그인/RLS 대수술 없음.
-- create_group INSERT에 app_id를 명시해 신규 그룹도 Family로 고정.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS app_id text;

UPDATE public.groups
SET app_id = 'hearth_family'
WHERE app_id IS NULL;

ALTER TABLE public.groups
  ALTER COLUMN app_id SET DEFAULT 'hearth_family';

ALTER TABLE public.groups
  ALTER COLUMN app_id SET NOT NULL;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_app_id_check;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_app_id_check
  CHECK (app_id IN ('hearth_family', 'hearth_couple'));

CREATE INDEX IF NOT EXISTS idx_groups_app_id ON public.groups (app_id);

CREATE OR REPLACE FUNCTION public.create_group(
  group_name text,
  invite_code_param text,
  owner_id_param uuid DEFAULT NULL,
  display_name_pending_param boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
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

  INSERT INTO public.groups (name, invite_code, owner_id, display_name_pending, app_id)
  VALUES (final_name, invite_code_param, final_owner_id, final_pending, 'hearth_family')
  RETURNING id INTO new_group_id;

  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (final_owner_id, new_group_id, 'ADMIN')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN new_group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_group(text, text, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group(text, text, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid, boolean) TO authenticated, service_role;
