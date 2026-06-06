-- 그룹 표시 이름 통합: display_name_pending + create_group 확장 + 레거시 backfill
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. display_name_pending 컬럼
-- ============================================

ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS display_name_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.display_name_pending IS
  'true면 대시보드·액자는 app_title/Hearth 기본 표시. name은 내부 placeholder.';

-- ============================================
-- 2. create_group RPC — 「나중에 정하기」 지원
-- ============================================

CREATE OR REPLACE FUNCTION public.create_group(
  group_name TEXT,
  invite_code_param TEXT,
  owner_id_param UUID DEFAULT NULL,
  display_name_pending_param BOOLEAN DEFAULT FALSE
)
RETURNS UUID
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

-- 이전 3-인자 시그니처 호환 (display_name_pending 기본 false)
CREATE OR REPLACE FUNCTION public.create_group(
  group_name TEXT,
  invite_code_param TEXT,
  owner_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.create_group(group_name, invite_code_param, owner_id_param, false);
$$;

REVOKE ALL ON FUNCTION public.create_group(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group(text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid) TO authenticated, service_role;

-- ============================================
-- 3. 레거시 backfill
-- ============================================

-- family_name만 있고 name이 placeholder/비어 있으면 name 보강
UPDATE public.groups
SET name = trim(family_name),
    display_name_pending = false
WHERE display_name_pending = false
  AND (trim(name) = '' OR name = '__display_name_pending__')
  AND family_name IS NOT NULL
  AND trim(family_name) <> '';

-- name은 있는데 family_name이 비어 있으면 mirror (레거시 호환)
UPDATE public.groups
SET family_name = trim(name)
WHERE display_name_pending = false
  AND trim(name) <> ''
  AND name <> '__display_name_pending__'
  AND (family_name IS NULL OR trim(family_name) = '');
