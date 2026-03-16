-- 여행 플래너 통합 구조 리팩토링
-- 관광지, 교통 테이블 추가 및 show_in_itinerary 플래그 통합
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. travel_attractions (관광지) 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_attractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  description TEXT,
  show_in_itinerary BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_attractions_trip_id ON public.travel_attractions(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_attractions_group_id ON public.travel_attractions(group_id);
CREATE INDEX IF NOT EXISTS idx_travel_attractions_deleted_at ON public.travel_attractions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_travel_attractions_show_in_itinerary ON public.travel_attractions(show_in_itinerary) WHERE show_in_itinerary = true;

ALTER TABLE public.travel_attractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_attractions_select" ON public.travel_attractions
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_attractions_insert" ON public.travel_attractions
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_attractions_update" ON public.travel_attractions
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_attractions_delete" ON public.travel_attractions
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_attractions IS '가족 여행 플래너 - 관광지';
COMMENT ON COLUMN public.travel_attractions.show_in_itinerary IS '일정 뷰에 표시 여부';

-- ============================================
-- 2. travel_transports (교통) 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.travel_transports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('air', 'train', 'car', 'bike')),
  day_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  departure TEXT,
  arrival TEXT,
  distance_km NUMERIC,
  memo TEXT,
  show_in_itinerary BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_travel_transports_trip_id ON public.travel_transports(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_transports_group_id ON public.travel_transports(group_id);
CREATE INDEX IF NOT EXISTS idx_travel_transports_deleted_at ON public.travel_transports(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_travel_transports_show_in_itinerary ON public.travel_transports(show_in_itinerary) WHERE show_in_itinerary = true;

ALTER TABLE public.travel_transports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_transports_select" ON public.travel_transports
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_transports_insert" ON public.travel_transports
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_transports_update" ON public.travel_transports
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "travel_transports_delete" ON public.travel_transports
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_transports IS '가족 여행 플래너 - 교통';
COMMENT ON COLUMN public.travel_transports.transport_type IS '교통수단: air(비행기), train(기차), car(자동차), bike(바이크)';
COMMENT ON COLUMN public.travel_transports.distance_km IS '이동 거리(km)';
COMMENT ON COLUMN public.travel_transports.show_in_itinerary IS '일정 뷰에 표시 여부';

-- ============================================
-- 3. 기존 테이블에 show_in_itinerary 플래그 추가
-- ============================================

-- 숙소
ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS show_in_itinerary BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_accommodations_show_in_itinerary 
  ON public.travel_accommodations(show_in_itinerary) WHERE show_in_itinerary = true;

COMMENT ON COLUMN public.travel_accommodations.show_in_itinerary IS '일정 뷰에 표시 여부';

-- 먹거리
ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS show_in_itinerary BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_dining_show_in_itinerary 
  ON public.travel_dining(show_in_itinerary) WHERE show_in_itinerary = true;

COMMENT ON COLUMN public.travel_dining.show_in_itinerary IS '일정 뷰에 표시 여부';

-- ============================================
-- 4. travel_itineraries: "기타" 전용으로 단순화
-- ============================================

-- 기존 place_type 제약 제거
ALTER TABLE public.travel_itineraries
  DROP CONSTRAINT IF EXISTS travel_itineraries_place_type_check;

-- 이제 place_type은 항상 'other' 또는 NULL
ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_place_type_other_only
  CHECK (place_type IS NULL OR place_type = 'other');

COMMENT ON TABLE public.travel_itineraries IS '가족 여행 플래너 - 기타 일정 (개별 섹션 없이 일정에서만 추가)';
COMMENT ON COLUMN public.travel_itineraries.place_type IS '항상 other 또는 NULL. 관광지/교통은 이제 별도 테이블 사용';

-- 기존 source_type, source_id 컬럼도 이제 사용 안 함 (호환성 유지)
COMMENT ON COLUMN public.travel_itineraries.source_type IS '더 이상 사용 안 함 (레거시 호환용)';
COMMENT ON COLUMN public.travel_itineraries.source_id IS '더 이상 사용 안 함 (레거시 호환용)';

SELECT '여행 플래너 통합 구조 리팩토링 완료: travel_attractions, travel_transports 생성 및 show_in_itinerary 플래그 추가됨' AS message;
