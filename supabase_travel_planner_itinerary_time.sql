-- 일정에 시작/종료 시간 추가 (HH:mm 형식, 선택 입력)
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS end_time TEXT;

COMMENT ON COLUMN public.travel_itineraries.start_time IS '시작 시간 HH:mm';
COMMENT ON COLUMN public.travel_itineraries.end_time IS '종료 시간 HH:mm';
