-- 시스템 관리자 본인 권한은 이번 세션이 TOTP(AAL2)일 때만 연다.
-- 다른 사용자 소속 조회와 service role 조회(auth.uid() 없음)는 테이블 소속만 본다.

CREATE OR REPLACE FUNCTION public.is_system_admin(user_id_param uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF user_id_param IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND user_id_param = auth.uid()
     AND COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2'
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE user_id = user_id_param
    AND is_active = TRUE
  );
END;
$function$;
