-- 일루와(come_here) 요청 타입 및 목적지 스냅샷 컬럼 추가
-- Supabase SQL Editor 또는 apply_migration으로 실행

ALTER TABLE public.location_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'where',
  ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_lng DOUBLE PRECISION;

ALTER TABLE public.location_requests
  DROP CONSTRAINT IF EXISTS location_requests_request_type_check;

ALTER TABLE public.location_requests
  ADD CONSTRAINT location_requests_request_type_check
  CHECK (request_type IN ('where', 'come_here'));

ALTER TABLE public.location_requests
  DROP CONSTRAINT IF EXISTS location_requests_come_here_destination_check;

ALTER TABLE public.location_requests
  ADD CONSTRAINT location_requests_come_here_destination_check
  CHECK (
    request_type = 'where'
    OR (destination_lat IS NOT NULL AND destination_lng IS NOT NULL)
  );
