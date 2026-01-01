-- 위치 요청 및 승인 시스템을 위한 Supabase 테이블 및 보안 규칙
-- Supabase SQL Editor에서 실행하세요
-- 전체 스크립트를 처음부터 끝까지 한 번에 실행하세요!

-- ============================================
-- 0. 기존 객체 완전 삭제 (깨끗하게 시작)
-- ============================================

-- 모든 테이블 삭제 (주의: 데이터가 모두 삭제됩니다)
-- CASCADE로 트리거와 정책도 함께 삭제됩니다
DROP TABLE IF EXISTS public.location_requests CASCADE;
DROP TABLE IF EXISTS public.user_locations CASCADE;

-- 모든 함수 삭제 (테이블 삭제 후)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_last_updated_column() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_location_requests() CASCADE;

-- ============================================
-- 1. location_requests 테이블 생성
-- ============================================

CREATE TABLE public.location_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL
);

-- 인덱스 추가
CREATE INDEX idx_location_requests_requester ON public.location_requests(requester_id);
CREATE INDEX idx_location_requests_target ON public.location_requests(target_id);
CREATE INDEX idx_location_requests_status ON public.location_requests(status);
CREATE INDEX idx_location_requests_created_at ON public.location_requests(created_at);
CREATE UNIQUE INDEX idx_location_requests_unique_pending 
ON public.location_requests(requester_id, target_id) 
WHERE status = 'pending';

-- ============================================
-- 2. user_locations 테이블 생성
-- ============================================

CREATE TABLE public.user_locations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 추가
CREATE INDEX idx_user_locations_last_updated ON public.user_locations(last_updated);

-- ============================================
-- 3. 트리거 함수 생성
-- ============================================

-- location_requests용 updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- user_locations용 last_updated 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_last_updated_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated := NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 4. 트리거 생성
-- ============================================

CREATE TRIGGER update_location_requests_updated_at 
  BEFORE UPDATE ON public.location_requests
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_locations_last_updated 
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_last_updated_column();

-- ============================================
-- 5. RLS 활성화
-- ============================================

ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. location_requests 보안 규칙
-- ============================================

-- 읽기: 본인이 요청자이거나 대상자인 경우만
CREATE POLICY "위치 요청 읽기" ON public.location_requests
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- 작성: 인증된 사용자는 누구나 요청 가능 (본인이 요청자여야 함)
CREATE POLICY "위치 요청 작성" ON public.location_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = requester_id AND
    auth.uid() != target_id
  );

-- 수정: 대상자만 승인/거부 가능, 요청자는 취소만 가능
-- USING 절만 사용 (NEW는 WITH CHECK에서만 사용 가능하지만 오류 방지를 위해 제거)
CREATE POLICY "위치 요청 수정" ON public.location_requests
  FOR UPDATE
  USING (
    (auth.uid() = target_id AND status = 'pending') OR
    (auth.uid() = requester_id AND status = 'pending')
  );

-- 삭제: 요청자 또는 대상자만 삭제 가능
CREATE POLICY "위치 요청 삭제" ON public.location_requests
  FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- ============================================
-- 7. user_locations 보안 규칙
-- ============================================

-- 읽기: 본인 위치는 항상 읽기 가능, 다른 사용자 위치는 승인된 요청이 있는 경우만
CREATE POLICY "위치 읽기 승인된 관계" ON public.user_locations
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.location_requests
      WHERE (
        (requester_id = auth.uid() AND target_id = user_id) OR
        (requester_id = user_id AND target_id = auth.uid())
      )
      AND status = 'accepted'
    )
  );

-- 작성: 본인만 자신의 위치를 작성 가능
CREATE POLICY "위치 작성 본인만" ON public.user_locations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- 수정: 본인만 자신의 위치를 수정 가능
CREATE POLICY "위치 수정 본인만" ON public.user_locations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인만 자신의 위치를 삭제 가능
CREATE POLICY "위치 삭제 본인만" ON public.user_locations
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 8. Realtime 활성화
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE location_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE user_locations;

-- ============================================
-- 9. 만료된 요청 자동 정리 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_location_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.location_requests
  WHERE expires_at < NOW() AND status = 'pending';
END;
$$;

-- 주기적으로 실행하려면 pg_cron 확장이 필요합니다
-- SELECT cron.schedule('cleanup-expired-requests', '0 0 * * *', 'SELECT public.cleanup_expired_location_requests()');
