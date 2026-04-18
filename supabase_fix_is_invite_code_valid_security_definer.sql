-- 근본 수정: is_invite_code_valid 가 SECURITY INVOKER 인 경우,
-- SECURITY DEFINER 인 join_group_by_invite_code / get_group_preview_by_invite_code 안에서 호출되어도
-- "현재 JWT 사용자" 권한으로 public.groups 를 읽게 되어 RLS 에 따라 행이 안 보이거나 만료 판정이 흔들릴 수 있다.
-- 초대 유효성은 항상 DB 권한으로 일관되게 읽도록 SECURITY DEFINER + search_path 고정.
--
-- Supabase SQL Editor 또는 마이그레이션으로 적용.

begin;

create or replace function public.is_invite_code_valid(invite_code_param text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expires_at timestamptz;
begin
  select invite_code_expires_at into expires_at
  from public.groups
  where invite_code = invite_code_param;

  if expires_at is null then
    return true;
  end if;

  return expires_at > now();
end;
$$;

revoke all on function public.is_invite_code_valid(text) from public;
grant execute on function public.is_invite_code_valid(text) to authenticated;
grant execute on function public.is_invite_code_valid(text) to service_role;

commit;
