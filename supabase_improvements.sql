-- 기존 테이블 유지 + 개선 사항
-- Supabase SQL Editor에서 실행하세요
-- 기존 테이블이 이미 있다면 이 스크립트만 실행하면 됩니다

-- ============================================
-- 1. 성능 향상을 위한 인덱스 추가
-- ============================================

-- family_tasks 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_family_tasks_assigned_to ON public.family_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_family_tasks_created_by ON public.family_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_family_tasks_created_at ON public.family_tasks(created_at);

-- family_events 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_family_events_event_date ON public.family_events(event_date);
CREATE INDEX IF NOT EXISTS idx_family_events_created_by ON public.family_events(created_by);

-- family_messages 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON public.family_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_family_messages_sender_id ON public.family_messages(sender_id);

-- memory_vault 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_memory_vault_created_at ON public.memory_vault(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_vault_uploader_id ON public.memory_vault(uploader_id);

-- ============================================
-- 2. updated_at 자동 업데이트 트리거
-- ============================================

-- updated_at 자동 업데이트 함수 (이미 있으면 재생성)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_locations의 updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_user_locations_updated_at ON public.user_locations;
CREATE TRIGGER update_user_locations_updated_at 
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. 기존 테이블에 updated_at 컬럼 추가 (선택사항)
-- 변경 이력을 추적하고 싶다면 주석 해제하세요
-- ============================================

-- ALTER TABLE public.family_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- ALTER TABLE public.family_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 트리거 추가 (위 컬럼을 추가했다면)
-- CREATE TRIGGER update_family_tasks_updated_at 
--   BEFORE UPDATE ON public.family_tasks
--   FOR EACH ROW 
--   EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER update_family_events_updated_at 
--   BEFORE UPDATE ON public.family_events
--   FOR EACH ROW 
--   EXECUTE FUNCTION public.update_updated_at_column();







































