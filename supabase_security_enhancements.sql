-- Supabase 보안 강화: 추가 RLS 정책 및 보안 규칙
-- 위치 데이터 무단 접근 방지를 위한 추가 보안 조치
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. 위치 데이터 접근 로그 테이블 (감사 추적)
-- ============================================

CREATE TABLE IF NOT EXISTS public.location_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('READ', 'WRITE', 'UPDATE', 'DELETE')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_location_access_logs_user_id ON public.location_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_location_access_logs_accessed_user_id ON public.location_access_logs(accessed_user_id);
CREATE INDEX IF NOT EXISTS idx_location_access_logs_created_at ON public.location_access_logs(created_at);

-- RLS 활성화
ALTER TABLE public.location_access_logs ENABLE ROW LEVEL SECURITY;

-- 로그 읽기: 본인의 로그만 읽기 가능
CREATE POLICY "위치 접근 로그 읽기 본인만" ON public.location_access_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- 로그 작성: 시스템만 작성 가능 (트리거를 통해)
-- 직접 INSERT는 불가능하도록 설정

-- ============================================
-- 2. 위치 데이터 접근 감사 트리거
-- ============================================

CREATE OR REPLACE FUNCTION public.log_location_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 위치 읽기 시 로그 기록
  IF TG_OP = 'SELECT' THEN
    INSERT INTO public.location_access_logs (
      user_id,
      accessed_user_id,
      access_type,
      ip_address,
      user_agent
    ) VALUES (
      auth.uid(),
      NEW.user_id,
      'READ',
      NULL, -- IP 주소는 애플리케이션 레벨에서 전달 필요
      NULL  -- User Agent는 애플리케이션 레벨에서 전달 필요
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거는 RLS 정책과 충돌할 수 있으므로 주석 처리
-- 필요시 애플리케이션 레벨에서 로깅 구현 권장

-- ============================================
-- 3. 위치 요청 빈도 제한 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.check_location_request_rate_limit(
  p_user_id UUID,
  p_limit_count INTEGER DEFAULT 10,
  p_limit_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_count INTEGER;
BEGIN
  -- 최근 N분 동안의 요청 수 확인
  SELECT COUNT(*)
  INTO v_request_count
  FROM public.location_requests
  WHERE requester_id = p_user_id
    AND created_at > NOW() - (p_limit_minutes || ' minutes')::INTERVAL;
  
  -- 제한 초과 시 false 반환
  IF v_request_count >= p_limit_count THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================
-- 4. 위치 데이터 무결성 검증 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_location_data(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 위도 범위 검증 (-90 ~ 90)
  IF p_latitude < -90 OR p_latitude > 90 THEN
    RETURN false;
  END IF;
  
  -- 경도 범위 검증 (-180 ~ 180)
  IF p_longitude < -180 OR p_longitude > 180 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================
-- 5. user_locations 테이블에 무결성 검증 추가
-- ============================================

-- CHECK 제약 조건 추가
ALTER TABLE public.user_locations
  ADD CONSTRAINT check_latitude_range 
  CHECK (latitude >= -90 AND latitude <= 90);

ALTER TABLE public.user_locations
  ADD CONSTRAINT check_longitude_range 
  CHECK (longitude >= -180 AND longitude <= 180);

-- ============================================
-- 6. 위치 요청 스팸 방지: 중복 요청 제한
-- ============================================

-- 이미 UNIQUE 인덱스가 있지만, 추가 검증 함수
CREATE OR REPLACE FUNCTION public.prevent_duplicate_location_request(
  p_requester_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- 최근 5분 내 동일한 요청 확인
  SELECT COUNT(*)
  INTO v_existing_count
  FROM public.location_requests
  WHERE requester_id = p_requester_id
    AND target_id = p_target_id
    AND status = 'pending'
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  IF v_existing_count > 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================
-- 7. 위치 데이터 암호화 저장 (선택 사항)
-- ============================================

-- 민감한 위치 데이터는 애플리케이션 레벨에서 암호화하여 저장하는 것을 권장
-- 데이터베이스 레벨 암호화는 pgcrypto 확장 필요

-- ============================================
-- 8. 추가 보안 정책: 위치 데이터 수정 이력
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_locations_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_locations_history_user_id ON public.user_locations_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_history_changed_at ON public.user_locations_history(changed_at);

-- RLS 활성화
ALTER TABLE public.user_locations_history ENABLE ROW LEVEL SECURITY;

-- 읽기: 본인의 위치 이력만 읽기 가능
CREATE POLICY "위치 이력 읽기 본인만" ON public.user_locations_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 작성: 시스템만 작성 가능 (트리거를 통해)

-- 위치 변경 이력 기록 트리거
CREATE OR REPLACE FUNCTION public.log_location_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 위치가 변경되었을 때만 이력 기록
  IF OLD.latitude != NEW.latitude OR OLD.longitude != NEW.longitude THEN
    INSERT INTO public.user_locations_history (
      user_id,
      latitude,
      longitude,
      address,
      changed_by
    ) VALUES (
      NEW.user_id,
      NEW.latitude,
      NEW.longitude,
      NEW.address,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_user_locations_change
  AFTER UPDATE ON public.user_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_location_change();

-- ============================================
-- 9. 보안 감사: 의심스러운 접근 패턴 감지
-- ============================================

CREATE OR REPLACE FUNCTION public.detect_suspicious_location_access()
RETURNS TABLE (
  user_id UUID,
  access_count BIGINT,
  accessed_users_count BIGINT,
  time_period INTERVAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.user_id,
    COUNT(*) as access_count,
    COUNT(DISTINCT l.accessed_user_id) as accessed_users_count,
    MAX(l.created_at) - MIN(l.created_at) as time_period
  FROM public.location_access_logs l
  WHERE l.created_at > NOW() - INTERVAL '1 hour'
  GROUP BY l.user_id
  HAVING COUNT(*) > 100 OR COUNT(DISTINCT l.accessed_user_id) > 50
  ORDER BY access_count DESC;
END;
$$;

-- ============================================
-- 10. 위치 데이터 자동 만료 정리
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_location_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 30일 이상 업데이트되지 않은 위치 데이터 삭제
  DELETE FROM public.user_locations
  WHERE last_updated < NOW() - INTERVAL '30 days';
  
  -- 90일 이상 된 위치 접근 로그 삭제
  DELETE FROM public.location_access_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- 1년 이상 된 위치 이력 삭제
  DELETE FROM public.user_locations_history
  WHERE changed_at < NOW() - INTERVAL '1 year';
END;
$$;

-- 주기적으로 실행하려면 pg_cron 확장이 필요합니다
-- SELECT cron.schedule('cleanup-old-location-data', '0 2 * * *', 'SELECT public.cleanup_old_location_data()');


