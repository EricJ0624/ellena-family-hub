-- place_type에 기타(무연동) 추가: attraction, transport_air, transport_car, transport_bike, other
-- supabase_travel_itineraries_place_type.sql 적용 후 실행하세요.

ALTER TABLE public.travel_itineraries
  DROP CONSTRAINT IF EXISTS travel_itineraries_place_type_check;

ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_place_type_check
  CHECK (place_type IS NULL OR place_type IN ('attraction', 'transport_air', 'transport_car', 'transport_bike', 'other'));

COMMENT ON COLUMN public.travel_itineraries.place_type IS '지도 마커 구분: attraction(관광지), transport_air(비행기), transport_car(자동차), transport_bike(바이크), other(기타 무연동). NULL=관광지와 동일';

SELECT 'travel_itineraries.place_type에 other가 추가되었습니다.' AS message;
