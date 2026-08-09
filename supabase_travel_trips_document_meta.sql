-- 여행 PDF/문서용 메타 + 일차 제목
-- travel_trips: cover/subtitle/theme/travelers/flight/emergency/packing
-- travel_day_titles: Day N 제목

ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS cover_badge text,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS travelers_text text,
  ADD COLUMN IF NOT EXISTS flight_summary text,
  ADD COLUMN IF NOT EXISTS emergency_contacts jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS packing_checklist jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.travel_trips.cover_badge IS 'PDF/문서 표지 뱃지 (비우면 FAMILY VOYAGE {연도})';
COMMENT ON COLUMN public.travel_trips.subtitle IS 'PDF/문서 영문·보조 서브타이틀';
COMMENT ON COLUMN public.travel_trips.theme IS '여행 메인 테마';
COMMENT ON COLUMN public.travel_trips.travelers_text IS '여행자 표시 문구';
COMMENT ON COLUMN public.travel_trips.flight_summary IS '항공편 요약 (수동 또는 자동 보조)';
COMMENT ON COLUMN public.travel_trips.emergency_contacts IS '긴급 연락처 { local, consular, embassy }';
COMMENT ON COLUMN public.travel_trips.packing_checklist IS '준비물 [{ id, category, text, checked }]';

CREATE TABLE IF NOT EXISTS public.travel_day_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  day_date date NOT NULL,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (trip_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_travel_day_titles_trip_id ON public.travel_day_titles (trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_day_titles_group_id ON public.travel_day_titles (group_id);
CREATE INDEX IF NOT EXISTS idx_travel_day_titles_deleted_at ON public.travel_day_titles (deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE public.travel_day_titles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_day_titles_select ON public.travel_day_titles;
DROP POLICY IF EXISTS travel_day_titles_insert ON public.travel_day_titles;
DROP POLICY IF EXISTS travel_day_titles_update ON public.travel_day_titles;
DROP POLICY IF EXISTS travel_day_titles_delete ON public.travel_day_titles;

CREATE POLICY travel_day_titles_select ON public.travel_day_titles
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_day_titles_insert ON public.travel_day_titles
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_day_titles_update ON public.travel_day_titles
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_day_titles_delete ON public.travel_day_titles
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_day_titles IS '여행 일차별 제목 (PDF/상세 일정 Day N 헤더)';
