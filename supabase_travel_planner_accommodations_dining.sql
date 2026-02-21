-- 가족 여행 플래너: 숙소 + 먹거리 테이블 (방식 A)
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. travel_accommodations (숙소)
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  address TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT travel_accommodations_dates CHECK (check_out_date >= check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_travel_accommodations_trip_id ON public.travel_accommodations(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_accommodations_group_id ON public.travel_accommodations(group_id);
CREATE INDEX IF NOT EXISTS idx_travel_accommodations_deleted_at ON public.travel_accommodations(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE public.travel_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_accommodations_select" ON public.travel_accommodations
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_accommodations_insert" ON public.travel_accommodations
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_accommodations_update" ON public.travel_accommodations
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_accommodations_delete" ON public.travel_accommodations
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_accommodations IS '가족 여행 플래너 - 숙소';

-- ============================================
-- 2. travel_dining (먹거리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_dining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_date DATE NOT NULL,
  time_at TEXT,
  category TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_dining_trip_id ON public.travel_dining(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_dining_group_id ON public.travel_dining(group_id);
CREATE INDEX IF NOT EXISTS idx_travel_dining_deleted_at ON public.travel_dining(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE public.travel_dining ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_dining_select" ON public.travel_dining
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_dining_insert" ON public.travel_dining
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_dining_update" ON public.travel_dining
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_dining_delete" ON public.travel_dining
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_dining IS '가족 여행 플래너 - 먹거리';
COMMENT ON COLUMN public.travel_dining.time_at IS '시간 HH:mm (선택)';
COMMENT ON COLUMN public.travel_dining.category IS '예: 아침, 점심, 저녁, 카페';
