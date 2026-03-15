-- travel_itineraries: 일정 구분(지도 마커용) — 관광지, 비행기, 자동차, 바이크
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS place_type TEXT;

ALTER TABLE public.travel_itineraries
  DROP CONSTRAINT IF EXISTS travel_itineraries_place_type_check;

ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_place_type_check
  CHECK (place_type IS NULL OR place_type IN ('attraction', 'transport_air', 'transport_car', 'transport_bike'));

COMMENT ON COLUMN public.travel_itineraries.place_type IS '지도 마커 구분: attraction(관광지), transport_air(비행기), transport_car(자동차), transport_bike(바이크). NULL=관광지와 동일';

SELECT 'travel_itineraries.place_type 컬럼이 추가되었습니다.' AS message;
