-- AI API 키 QR 공유용 1회성 토큰 (서버 service_role 전용, 최대 3분 TTL)
-- MCP apply_migration: ai_key_share_tokens 와 동일

create table if not exists public.ai_key_share_tokens (
  token text primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'custom')),
  api_key_ciphertext text not null,
  base_url text,
  model text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_key_share_tokens_expires_at
  on public.ai_key_share_tokens (expires_at);

create index if not exists idx_ai_key_share_tokens_group_owner
  on public.ai_key_share_tokens (group_id, owner_user_id);

alter table public.ai_key_share_tokens enable row level security;
alter table public.ai_key_share_tokens force row level security;

-- 클라이언트 직접 접근 금지. API는 service_role만 사용.
revoke all on table public.ai_key_share_tokens from anon;
revoke all on table public.ai_key_share_tokens from authenticated;

grant select, insert, update, delete
  on public.ai_key_share_tokens
  to service_role;

comment on table public.ai_key_share_tokens is
  'One-time AI API key share tokens for in-app QR. Short TTL; deleted after redeem. No permanent key storage.';
