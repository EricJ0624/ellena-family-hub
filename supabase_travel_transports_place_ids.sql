-- travel_transports 출발/도착 Place ID 저장 컬럼 추가
-- 자동완성 선택 기반 저장 + 직접 입력 모드(place_id null) 지원

ALTER TABLE public.travel_transports
  ADD COLUMN IF NOT EXISTS departure_place_id TEXT,
  ADD COLUMN IF NOT EXISTS arrival_place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_transports_departure_place_id
  ON public.travel_transports(departure_place_id)
  WHERE departure_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_transports_arrival_place_id
  ON public.travel_transports(arrival_place_id)
  WHERE arrival_place_id IS NOT NULL;

COMMENT ON COLUMN public.travel_transports.departure_place_id IS '교통 출발지 Google Place ID (자동완성 선택 시)';
COMMENT ON COLUMN public.travel_transports.arrival_place_id IS '교통 도착지 Google Place ID (자동완성 선택 시)';
