-- 온보딩 RLS 디버그용 RPC 제거 (앱에서 더 이상 호출하지 않음)

DROP FUNCTION IF EXISTS public.debug_get_auth_uid();
