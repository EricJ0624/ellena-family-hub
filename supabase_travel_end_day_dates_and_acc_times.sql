-- 여행 플래너: 종료일(다중 날 표시), 숙소 체크인/체크아웃 시각(HH:mm, 선택)
-- Supabase SQL Editor에서 실행하세요.

-- ── 숙소 시각 ──
ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS check_in_time TEXT;
ALTER TABLE public.travel_accommodations
  ADD COLUMN IF NOT EXISTS check_out_time TEXT;

COMMENT ON COLUMN public.travel_accommodations.check_in_time IS '체크인 시각 HH:mm (선택)';
COMMENT ON COLUMN public.travel_accommodations.check_out_time IS '체크아웃 시각 HH:mm (선택)';

-- ── 일정 종료일 ── (NULL = day_date 하루만)
ALTER TABLE public.travel_attractions
  ADD COLUMN IF NOT EXISTS end_day_date DATE;
ALTER TABLE public.travel_attractions DROP CONSTRAINT IF EXISTS travel_attractions_end_day_date_check;
ALTER TABLE public.travel_attractions ADD CONSTRAINT travel_attractions_end_day_date_check
  CHECK (end_day_date IS NULL OR end_day_date >= day_date);

COMMENT ON COLUMN public.travel_attractions.end_day_date IS '일정이 걸치는 종료일(포함). NULL이면 day_date만';

ALTER TABLE public.travel_transports
  ADD COLUMN IF NOT EXISTS end_day_date DATE;
ALTER TABLE public.travel_transports DROP CONSTRAINT IF EXISTS travel_transports_end_day_date_check;
ALTER TABLE public.travel_transports ADD CONSTRAINT travel_transports_end_day_date_check
  CHECK (end_day_date IS NULL OR end_day_date >= day_date);

COMMENT ON COLUMN public.travel_transports.end_day_date IS '일정이 걸치는 종료일(포함). NULL이면 day_date만';

ALTER TABLE public.travel_dining
  ADD COLUMN IF NOT EXISTS end_day_date DATE;
ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_end_day_date_check;
ALTER TABLE public.travel_dining ADD CONSTRAINT travel_dining_end_day_date_check
  CHECK (end_day_date IS NULL OR end_day_date >= day_date);

COMMENT ON COLUMN public.travel_dining.end_day_date IS '일정이 걸치는 종료일(포함). NULL이면 day_date만';

ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS end_day_date DATE;
ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_end_day_date_check;
ALTER TABLE public.travel_itineraries ADD CONSTRAINT travel_itineraries_end_day_date_check
  CHECK (end_day_date IS NULL OR end_day_date >= day_date);

COMMENT ON COLUMN public.travel_itineraries.end_day_date IS '일정이 걸치는 종료일(포함). NULL이면 day_date만';
