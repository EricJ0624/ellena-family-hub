-- 일정-숙소/먹거리 연동(source_type/source_id) + 위치(지도) 필드
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. travel_itineraries: 연동 + 위치
-- ============================================
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

COMMENT ON COLUMN public.travel_itineraries.source_type IS 'accommodation | dining (자동 생성된 일정인 경우)';
COMMENT ON COLUMN public.travel_itineraries.source_id IS '연결된 travel_accommodations.id 또는 travel_dining.id';
COMMENT ON COLUMN public.travel_itineraries.address IS '주소 (지도 표시용)';
COMMENT ON COLUMN public.travel_itineraries.latitude IS '위도';
COMMENT ON COLUMN public.travel_itineraries.longitude IS '경도';

CREATE INDEX IF NOT EXISTS idx_travel_itineraries_source ON public.travel_itineraries(source_type, source_id) WHERE source_type IS NOT NULL;

-- ============================================
-- 2. travel_accommodations: 위도/경도
-- ============================================
ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

COMMENT ON COLUMN public.travel_accommodations.latitude IS '위도';
COMMENT ON COLUMN public.travel_accommodations.longitude IS '경도';

-- ============================================
-- 3. travel_dining: 주소 + 위도/경도
-- ============================================
ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

COMMENT ON COLUMN public.travel_dining.address IS '주소 (지도 표시용)';
COMMENT ON COLUMN public.travel_dining.latitude IS '위도';
COMMENT ON COLUMN public.travel_dining.longitude IS '경도';
