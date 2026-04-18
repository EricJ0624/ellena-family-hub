-- 민감 RPC·헬퍼에 대한 EXECUTE 권한을 anon/PUBLIC에서 제거하고 authenticated(+service_role)로 한정
-- + is_invite_code_valid: 존재하지 않는 초대 코드는 false 반환 (이전에는 NULL 만료로 true 오판 가능)
--
-- Supabase SQL Editor 또는 apply_migration 으로 적용

-- 1) 초대 코드 유효성: 행이 없으면 false
create or replace function public.is_invite_code_valid(invite_code_param text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expires_at timestamptz;
begin
  select g.invite_code_expires_at
    into expires_at
  from public.groups g
  where g.invite_code = invite_code_param;

  if not found then
    return false;
  end if;

  if expires_at is null then
    return true;
  end if;

  return expires_at > now();
end;
$$;

-- 2) EXECUTE: PUBLIC/anon 제거 후 필요 역할만 허용
revoke all on function public.is_invite_code_valid(text) from public;
grant execute on function public.is_invite_code_valid(text) to authenticated, service_role;

revoke all on function public.create_group(text, text) from public;
revoke all on function public.create_group(text, text, uuid) from public;
grant execute on function public.create_group(text, text) to authenticated, service_role;
grant execute on function public.create_group(text, text, uuid) to authenticated, service_role;

revoke all on function public.join_group_by_invite_code(text) from public;
grant execute on function public.join_group_by_invite_code(text) to authenticated, service_role;

revoke all on function public.get_group_preview_by_invite_code(text) from public;
grant execute on function public.get_group_preview_by_invite_code(text) to authenticated, service_role;

revoke all on function public.generate_invite_code() from public;
grant execute on function public.generate_invite_code() to authenticated, service_role;

revoke all on function public.generate_secure_invite_code() from public;
grant execute on function public.generate_secure_invite_code() to authenticated, service_role;

revoke all on function public.is_system_admin(uuid) from public;
grant execute on function public.is_system_admin(uuid) to authenticated, service_role;

revoke all on function public.debug_get_auth_uid() from public;
grant execute on function public.debug_get_auth_uid() to authenticated, service_role;

revoke all on function public.refresh_invite_code(uuid, integer) from public;
grant execute on function public.refresh_invite_code(uuid, integer) to authenticated, service_role;

revoke all on function public.update_member_role(uuid, uuid, text) from public;
grant execute on function public.update_member_role(uuid, uuid, text) to authenticated, service_role;

-- Supabase 기본 권한 등으로 anon에 직접 EXECUTE가 남는 경우가 있어 명시적으로 제거
revoke all on function public.is_invite_code_valid(text) from anon;
revoke all on function public.create_group(text, text) from anon;
revoke all on function public.create_group(text, text, uuid) from anon;
revoke all on function public.join_group_by_invite_code(text) from anon;
revoke all on function public.get_group_preview_by_invite_code(text) from anon;
revoke all on function public.generate_invite_code() from anon;
revoke all on function public.generate_secure_invite_code() from anon;
revoke all on function public.is_system_admin(uuid) from anon;
revoke all on function public.debug_get_auth_uid() from anon;
revoke all on function public.refresh_invite_code(uuid, integer) from anon;
revoke all on function public.update_member_role(uuid, uuid, text) from anon;
