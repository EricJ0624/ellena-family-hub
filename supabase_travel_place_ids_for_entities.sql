-- 장소성 엔티티에 place_id 컬럼 추가 (공통 place_cache 참조용)
-- 대상: 숙소, 먹거리, 관광지

ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS place_id TEXT;

ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS place_id TEXT;

ALTER TABLE public.travel_attractions
  ADD COLUMN IF NOT EXISTS place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_accommodations_place_id
  ON public.travel_accommodations(place_id)
  WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_dining_place_id
  ON public.travel_dining(place_id)
  WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_attractions_place_id
  ON public.travel_attractions(place_id)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.travel_accommodations.place_id IS '숙소 Google Place ID (자동완성 선택 시)';
COMMENT ON COLUMN public.travel_dining.place_id IS '먹거리 Google Place ID (자동완성 선택 시)';
COMMENT ON COLUMN public.travel_attractions.place_id IS '관광지 Google Place ID (자동완성 선택 시)';
