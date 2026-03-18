-- Fix "Function Search Path Mutable" warnings by pinning search_path
-- Applied via MCP migration: fix_function_search_path_security

begin;

alter function public.add_group_owner_as_admin() set search_path = pg_catalog, public;
alter function public.add_system_admin(uuid, text) set search_path = pg_catalog, public;
alter function public.cleanup_expired_location_requests() set search_path = pg_catalog, public;
alter function public.cleanup_inactive_push_tokens() set search_path = pg_catalog, public;
alter function public.create_group(text, text, uuid) set search_path = pg_catalog, public;
alter function public.create_group(text, text) set search_path = pg_catalog, public;
alter function public.debug_get_auth_uid() set search_path = pg_catalog, public;
alter function public.generate_invite_code() set search_path = pg_catalog, public;
alter function public.generate_invite_code_12() set search_path = pg_catalog, public;
alter function public.generate_secure_invite_code() set search_path = pg_catalog, public;
alter function public.get_group_preview_by_invite_code(text) set search_path = pg_catalog, public;
alter function public.get_system_admins() set search_path = pg_catalog, public;
alter function public.is_admin_of_group(uuid) set search_path = pg_catalog, public;
alter function public.is_group_admin(uuid, uuid) set search_path = pg_catalog, public;
alter function public.is_group_member(uuid, uuid) set search_path = pg_catalog, public;
alter function public.is_invite_code_valid(text) set search_path = pg_catalog, public;
alter function public.is_member_of_group(uuid) set search_path = pg_catalog, public;
alter function public.is_system_admin(uuid) set search_path = pg_catalog, public;
alter function public.join_group_by_invite_code(text) set search_path = pg_catalog, public;
alter function public.refresh_invite_code(uuid, integer) set search_path = pg_catalog, public;
alter function public.set_groups_owner_id() set search_path = pg_catalog, public;
alter function public.update_admin_last_access() set search_path = pg_catalog, public;
alter function public.update_groups_updated_at_column() set search_path = pg_catalog, public;
alter function public.update_last_updated_column() set search_path = pg_catalog, public;
alter function public.update_member_role(uuid, uuid, text) set search_path = pg_catalog, public;
alter function public.update_push_tokens_updated_at() set search_path = pg_catalog, public;
alter function public.update_updated_at_column() set search_path = pg_catalog, public;
alter function public.update_user_nickname() set search_path = pg_catalog, public;
alter function public.upsert_user_location(uuid, uuid, numeric, numeric, text, timestamp with time zone) set search_path = pg_catalog, public;

commit;

