-- 시스템 관리자와 그룹 관리자 간 통신 시스템
-- 공지사항, 문의하기, 대시보드 접근 요청 기능
-- Supabase SQL Editor에서 실행하세요
-- 전체 스크립트를 처음부터 끝까지 한 번에 실행하세요!

-- ============================================
-- 1. 공지사항 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 시스템 관리자
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true -- 비활성화된 공지 숨기기
);

-- 공지사항 읽음 상태 (그룹 관리자별)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

-- ============================================
-- 2. 문의 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 그룹 관리자
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  answer TEXT, -- 시스템 관리자 답변
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 시스템 관리자
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 3. 대시보드 접근 요청 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.dashboard_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 그룹 관리자
  reason TEXT NOT NULL, -- 접근 요청 이유
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'revoked')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 시스템 관리자
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- 접근 권한 만료 시간 (승인 시 설정, 예: 24시간 후)
  revoked_at TIMESTAMPTZ, -- 시스템 관리자가 수동으로 취소한 시간
  rejection_reason TEXT, -- 거절 사유
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 4. 대시보드 접근 로그 테이블 (감사 로그)
-- ============================================

CREATE TABLE IF NOT EXISTS public.dashboard_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_id UUID REFERENCES public.dashboard_access_requests(id) ON DELETE SET NULL,
  system_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  session_duration_seconds INTEGER, -- 세션 지속 시간 (종료 시 기록)
  ip_address TEXT, -- 접근 IP (선택사항)
  user_agent TEXT -- 브라우저 정보 (선택사항)
);

-- ============================================
-- 5. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON public.announcement_reads(announcement_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_group_id ON public.support_tickets(group_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON public.support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_requests_group_id ON public.dashboard_access_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_requests_status ON public.dashboard_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_requests_requested_by ON public.dashboard_access_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_requests_expires_at ON public.dashboard_access_requests(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_system_admin_id ON public.dashboard_access_logs(system_admin_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_group_id ON public.dashboard_access_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_logs_accessed_at ON public.dashboard_access_logs(accessed_at DESC);

-- ============================================
-- 6. updated_at 자동 업데이트 함수
-- ============================================

-- announcements updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION public.update_announcements_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- support_tickets updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- dashboard_access_requests updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION public.update_dashboard_access_requests_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 7. 트리거 생성
-- ============================================

DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at 
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_announcements_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at 
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_support_tickets_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_access_requests_updated_at ON public.dashboard_access_requests;
CREATE TRIGGER update_dashboard_access_requests_updated_at 
  BEFORE UPDATE ON public.dashboard_access_requests
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_dashboard_access_requests_updated_at_column();

-- ============================================
-- 8. RLS 활성화
-- ============================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_access_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. RLS 정책
-- ============================================

-- ============================================
-- 9.1. announcements RLS 정책
-- ============================================

-- 읽기: 모든 인증된 사용자 (활성 공지만)
DROP POLICY IF EXISTS "공지사항 읽기 - 인증된 사용자" ON public.announcements;
CREATE POLICY "공지사항 읽기 - 인증된 사용자" ON public.announcements
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- 작성: 시스템 관리자만
DROP POLICY IF EXISTS "공지사항 작성 - 시스템 관리자" ON public.announcements;
CREATE POLICY "공지사항 작성 - 시스템 관리자" ON public.announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 수정: 시스템 관리자만
DROP POLICY IF EXISTS "공지사항 수정 - 시스템 관리자" ON public.announcements;
CREATE POLICY "공지사항 수정 - 시스템 관리자" ON public.announcements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 삭제: 시스템 관리자만 (실제로는 is_active = false로 설정)
DROP POLICY IF EXISTS "공지사항 삭제 - 시스템 관리자" ON public.announcements;
CREATE POLICY "공지사항 삭제 - 시스템 관리자" ON public.announcements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- ============================================
-- 9.2. announcement_reads RLS 정책
-- ============================================

-- 읽기/쓰기: 본인만
DROP POLICY IF EXISTS "공지사항 읽음 상태 - 본인만" ON public.announcement_reads;
CREATE POLICY "공지사항 읽음 상태 - 본인만" ON public.announcement_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 9.3. support_tickets RLS 정책
-- ============================================

-- 읽기: 본인이 작성했거나 시스템 관리자
DROP POLICY IF EXISTS "문의 읽기" ON public.support_tickets;
CREATE POLICY "문의 읽기" ON public.support_tickets
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 작성: 그룹 관리자만 (그룹 ADMIN 또는 소유자)
DROP POLICY IF EXISTS "문의 작성 - 그룹 관리자" ON public.support_tickets;
CREATE POLICY "문의 작성 - 그룹 관리자" ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = support_tickets.group_id
      AND user_id = auth.uid()
      AND role = 'ADMIN'
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = support_tickets.group_id
      AND owner_id = auth.uid()
    )
  );

-- 수정: 본인이 작성했거나 시스템 관리자
DROP POLICY IF EXISTS "문의 수정" ON public.support_tickets;
CREATE POLICY "문의 수정" ON public.support_tickets
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 삭제: 본인만 (또는 시스템 관리자)
DROP POLICY IF EXISTS "문의 삭제" ON public.support_tickets;
CREATE POLICY "문의 삭제" ON public.support_tickets
  FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- ============================================
-- 9.4. dashboard_access_requests RLS 정책
-- ============================================

-- 읽기: 본인이 요청했거나 시스템 관리자
DROP POLICY IF EXISTS "접근 요청 읽기" ON public.dashboard_access_requests;
CREATE POLICY "접근 요청 읽기" ON public.dashboard_access_requests
  FOR SELECT
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 작성: 그룹 관리자만 (그룹 ADMIN 또는 소유자)
DROP POLICY IF EXISTS "접근 요청 작성 - 그룹 관리자" ON public.dashboard_access_requests;
CREATE POLICY "접근 요청 작성 - 그룹 관리자" ON public.dashboard_access_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = dashboard_access_requests.group_id
      AND user_id = auth.uid()
      AND role = 'ADMIN'
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = dashboard_access_requests.group_id
      AND owner_id = auth.uid()
    )
  );

-- 수정: 시스템 관리자만 (승인/거절/취소)
DROP POLICY IF EXISTS "접근 요청 수정 - 시스템 관리자" ON public.dashboard_access_requests;
CREATE POLICY "접근 요청 수정 - 시스템 관리자" ON public.dashboard_access_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 삭제: 본인만 (취소) 또는 시스템 관리자
DROP POLICY IF EXISTS "접근 요청 삭제" ON public.dashboard_access_requests;
CREATE POLICY "접근 요청 삭제" ON public.dashboard_access_requests
  FOR DELETE
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- ============================================
-- 9.5. dashboard_access_logs RLS 정책
-- ============================================

-- 읽기: 시스템 관리자만
DROP POLICY IF EXISTS "접근 로그 읽기 - 시스템 관리자" ON public.dashboard_access_logs;
CREATE POLICY "접근 로그 읽기 - 시스템 관리자" ON public.dashboard_access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- 작성: 시스템 관리자만
DROP POLICY IF EXISTS "접근 로그 작성 - 시스템 관리자" ON public.dashboard_access_logs;
CREATE POLICY "접근 로그 작성 - 시스템 관리자" ON public.dashboard_access_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- ============================================
-- 10. RPC 함수: 시스템 관리자의 그룹 대시보드 접근 권한 확인
-- ============================================

CREATE OR REPLACE FUNCTION public.can_access_group_dashboard(
  group_id_param UUID,
  admin_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_member BOOLEAN;
  has_active_access BOOLEAN;
BEGIN
  -- 1. 그룹 멤버인지 확인
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = admin_id_param
  ) INTO is_member;
  
  IF is_member THEN
    RETURN TRUE;
  END IF;
  
  -- 2. 그룹 소유자인지 확인
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = admin_id_param
  ) INTO is_member;
  
  IF is_member THEN
    RETURN TRUE;
  END IF;
  
  -- 3. 활성화된 접근 요청 확인
  SELECT EXISTS (
    SELECT 1 FROM public.dashboard_access_requests
    WHERE group_id = group_id_param
    AND status = 'approved'
    AND expires_at > NOW()
  ) INTO has_active_access;
  
  RETURN has_active_access;
END;
$$;

-- ============================================
-- 11. 만료된 접근 요청 자동 업데이트 함수 (선택사항)
-- ============================================

-- 만료된 접근 요청을 expired 상태로 변경하는 함수
CREATE OR REPLACE FUNCTION public.expire_dashboard_access_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.dashboard_access_requests
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'approved'
  AND expires_at <= NOW();
END;
$$;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '시스템 관리자와 그룹 관리자 간 통신 시스템 테이블 생성 완료!';
  RAISE NOTICE 'RLS 정책이 활성화되었습니다.';
  RAISE NOTICE '공지사항, 문의하기, 대시보드 접근 요청 기능이 준비되었습니다.';
END $$;
