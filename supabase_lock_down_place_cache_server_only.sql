-- Lock down place_cache to server-only access (service_role)
-- Applied via MCP migration: lock_down_place_cache_server_only

begin;

-- Ensure RLS is enabled and enforced
alter table public.place_cache enable row level security;
alter table public.place_cache force row level security;

-- Remove overly permissive policies
drop policy if exists "place_cache 읽기 인증 사용자" on public.place_cache;
drop policy if exists "place_cache 삽입 인증 사용자" on public.place_cache;
drop policy if exists "place_cache 수정 인증 사용자" on public.place_cache;

-- Remove direct table privileges from client roles (defense in depth)
revoke all on table public.place_cache from anon;
revoke all on table public.place_cache from authenticated;

commit;

