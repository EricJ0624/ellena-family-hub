-- 초대 링크 가입 시 이메일 인증 전에 초대 코드를 임시 저장하는 테이블
-- API(서버)에서만 service role로 접근하며, 인증 완료 후 조회·삭제됨
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS public.pending_invite_signups (
  email TEXT NOT NULL PRIMARY KEY,
  invite_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_invite_signups_created_at
  ON public.pending_invite_signups(created_at);

COMMENT ON TABLE public.pending_invite_signups IS '가입 전 초대 링크 코드 임시 저장 (이메일 인증 후 그룹 연결용)';
