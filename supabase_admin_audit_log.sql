-- 관리자 작업 감사 로그 테이블 (ADMIN_AUDIT_DESIGN.md 설계안)
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. admin_audit_log 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.admin_audit_log IS '시스템 관리자 작업 감사 로그 (삭제/복구/변경 등)';

-- ============================================
-- 2. 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_created
  ON public.admin_audit_log(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource
  ON public.admin_audit_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_group_created
  ON public.admin_audit_log(group_id, created_at DESC)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);

-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: 시스템 관리자만 조회 가능
DROP POLICY IF EXISTS "admin_audit_log_select_system_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select_system_admin" ON public.admin_audit_log
  FOR SELECT
  USING (public.is_system_admin(auth.uid()));

-- INSERT/UPDATE/DELETE: 정책 없음 → 서비스 역할(API)에서만 수행
-- (클라이언트는 직접 INSERT 불가)
