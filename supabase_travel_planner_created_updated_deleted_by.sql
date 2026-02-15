-- 가족 여행 플래너: created_by / updated_by / 삭제자 추적 (소프트 삭제)
-- 설계: docs/TRAVEL_PLANNER_CREATED_UPDATED_BY_DESIGN.md
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. travel_trips
-- ============================================
ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_trips_deleted_at ON public.travel_trips(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 2. travel_itineraries
-- ============================================
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_itineraries_deleted_at ON public.travel_itineraries(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 3. travel_expenses
-- ============================================
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_expenses_deleted_at ON public.travel_expenses(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.travel_trips.updated_by IS '마지막 수정자';
COMMENT ON COLUMN public.travel_trips.deleted_at IS '소프트 삭제 시각';
COMMENT ON COLUMN public.travel_trips.deleted_by IS '삭제한 사용자';
COMMENT ON COLUMN public.travel_itineraries.created_by IS '등록자';
COMMENT ON COLUMN public.travel_itineraries.updated_by IS '마지막 수정자';
COMMENT ON COLUMN public.travel_itineraries.deleted_by IS '삭제한 사용자';
COMMENT ON COLUMN public.travel_expenses.created_by IS '등록자';
COMMENT ON COLUMN public.travel_expenses.updated_by IS '마지막 수정자';
COMMENT ON COLUMN public.travel_expenses.deleted_by IS '삭제한 사용자';
