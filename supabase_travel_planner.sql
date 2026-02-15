-- 가족 여행 플래너 모듈 스키마 (Multi-tenant: group_id = tenant)
-- 기존 groups, auth.users와 관계만 추가. 기존 테이블 수정 없음.
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. trips (여행)
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT travel_trips_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_travel_trips_group_id ON public.travel_trips(group_id);
CREATE INDEX IF NOT EXISTS idx_travel_trips_dates ON public.travel_trips(start_date, end_date);

ALTER TABLE public.travel_trips ENABLE ROW LEVEL SECURITY;

-- RLS: 해당 그룹 멤버만 조회/삽입/수정/삭제 (기존 is_group_member(group_id, user_id) 시그니처 사용)
CREATE POLICY "travel_trips_select" ON public.travel_trips
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_trips_insert" ON public.travel_trips
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_trips_update" ON public.travel_trips
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_trips_delete" ON public.travel_trips
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

-- ============================================
-- 2. itineraries (일정)
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_itineraries_trip_id ON public.travel_itineraries(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_itineraries_group_id ON public.travel_itineraries(group_id);

ALTER TABLE public.travel_itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_itineraries_select" ON public.travel_itineraries
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_itineraries_insert" ON public.travel_itineraries
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_itineraries_update" ON public.travel_itineraries
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_itineraries_delete" ON public.travel_itineraries
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

-- ============================================
-- 3. expenses (경비)
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  memo TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_trip_id ON public.travel_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_group_id ON public.travel_expenses(group_id);

ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_expenses_select" ON public.travel_expenses
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_expenses_insert" ON public.travel_expenses
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_expenses_update" ON public.travel_expenses
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_expenses_delete" ON public.travel_expenses
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

-- (is_group_member는 fix_all_rls_recursion.sql 등 기존 마이그레이션에 정의됨)

COMMENT ON TABLE public.travel_trips IS '가족 여행 플래너 - 여행 (tenant = group_id)';
COMMENT ON TABLE public.travel_itineraries IS '가족 여행 플래너 - 일정';
COMMENT ON TABLE public.travel_expenses IS '가족 여행 플래너 - 경비';
