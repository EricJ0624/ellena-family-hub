-- Web Push 토큰 관리 테이블 및 보안 규칙
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 0. 기존 객체 삭제
-- ============================================

DROP TABLE IF EXISTS public.push_tokens CASCADE;

-- ============================================
-- 1. push_tokens 테이블 생성
-- ============================================

CREATE TABLE public.push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, token) -- 한 사용자가 같은 토큰을 중복 등록하지 않도록
);

-- 인덱스 추가
CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_is_active ON public.push_tokens(is_active);
CREATE INDEX idx_push_tokens_token ON public.push_tokens(token);

-- ============================================
-- 2. 트리거 함수 생성
-- ============================================

CREATE OR REPLACE FUNCTION public.update_push_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. 트리거 생성
-- ============================================

CREATE TRIGGER update_push_tokens_updated_at 
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_push_tokens_updated_at();

-- ============================================
-- 4. RLS 활성화
-- ============================================

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. 보안 규칙 (RLS Policies)
-- ============================================

-- 읽기: 본인의 토큰만 읽기 가능
CREATE POLICY "Push 토큰 읽기 본인만" ON public.push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- 작성: 본인만 자신의 토큰 등록 가능
CREATE POLICY "Push 토큰 작성 본인만" ON public.push_tokens
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = user_id
  );

-- 수정: 본인만 자신의 토큰 수정 가능
CREATE POLICY "Push 토큰 수정 본인만" ON public.push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인만 자신의 토큰 삭제 가능
CREATE POLICY "Push 토큰 삭제 본인만" ON public.push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. 만료된 토큰 자동 정리 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_inactive_push_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 30일 이상 비활성화된 토큰 삭제
  DELETE FROM public.push_tokens
  WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 주기적으로 실행하려면 pg_cron 확장이 필요합니다
-- SELECT cron.schedule('cleanup-inactive-push-tokens', '0 0 * * *', 'SELECT public.cleanup_inactive_push_tokens()');

