-- 베타가 켜져 있으면 기존과 같이 그룹 읽기를 허용한다.
-- 베타가 꺼진 뒤에만, 소유자·멤버의 직접 조회에 구독(또는 무료 제공)을 요구한다.
-- 대시보드 임시 권한(has_active_dashboard_grant)은 구독과 무관하게 그대로 둔다.
-- 검사 오류가 나면 잠그지 않는다.

CREATE OR REPLACE FUNCTION public.billing_allows_group_read(group_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  app text;
  beta_on boolean;
BEGIN
  SELECT g.app_id INTO app
  FROM public.groups g
  WHERE g.id = group_id_param;

  IF app IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT p.beta_period_enabled INTO beta_on
  FROM public.billing_plans p
  WHERE p.app_id = app;

  IF beta_on IS NULL OR beta_on IS DISTINCT FROM FALSE THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_group_overrides o
    WHERE o.group_id = group_id_param
      AND o.billing_comp IS TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.billing_subscriptions s
    WHERE s.group_id = group_id_param
      AND s.app_id = app
      AND s.status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN TRUE;
END;
$function$;

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
    RETURN public.billing_allows_group_read(group_id_param);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = user_id_param
  ) THEN
    RETURN public.billing_allows_group_read(group_id_param);
  END IF;

  RETURN public.has_active_dashboard_grant(group_id_param, user_id_param);
END;
$function$;
