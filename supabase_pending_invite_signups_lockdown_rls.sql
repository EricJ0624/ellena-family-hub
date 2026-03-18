-- Lock down pending_invite_signups to server-only access (service_role)
-- Mirrors the manual SQL you executed to resolve Security Advisor error:
-- "RLS Disabled in Public" for public.pending_invite_signups

begin;

alter table public.pending_invite_signups enable row level security;
alter table public.pending_invite_signups force row level security;

-- No policies: default deny for anon/authenticated

revoke all on table public.pending_invite_signups from anon;
revoke all on table public.pending_invite_signups from authenticated;

commit;

