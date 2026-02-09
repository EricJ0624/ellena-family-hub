-- 일정 반복(매월/매년) 기능용 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.family_events
ADD COLUMN IF NOT EXISTS repeat_type text DEFAULT 'none'
CHECK (repeat_type IN ('none', 'monthly', 'yearly'));

COMMENT ON COLUMN public.family_events.repeat_type IS '반복: none(없음), monthly(매월), yearly(매년)';
