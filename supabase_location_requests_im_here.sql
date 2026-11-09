-- 「나여기」는 누른 사람만 지도에 올리는 공유.
-- where(어디야)·come_here(일루와) 제약은 유지하고 im_here만 추가한다.

ALTER TABLE public.location_requests
  DROP CONSTRAINT IF EXISTS location_requests_request_type_check;

ALTER TABLE public.location_requests
  ADD CONSTRAINT location_requests_request_type_check
  CHECK (request_type IN ('where', 'come_here', 'im_here'));

ALTER TABLE public.location_requests
  DROP CONSTRAINT IF EXISTS location_requests_come_here_destination_check;

ALTER TABLE public.location_requests
  ADD CONSTRAINT location_requests_come_here_destination_check
  CHECK (
    request_type IN ('where', 'im_here')
    OR (destination_lat IS NOT NULL AND destination_lng IS NOT NULL)
  );
