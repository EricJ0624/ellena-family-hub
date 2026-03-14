-- ============================================
-- place_cache: Google Place Details 캐시 (전 사용자 공용, 영구 보관)
-- 동일 place_id면 구글 재호출 없이 캐시에서만 조회
-- ============================================

CREATE TABLE IF NOT EXISTS public.place_cache (
  place_id TEXT PRIMARY KEY,
  name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  formatted_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_cache_updated_at ON public.place_cache(updated_at);

COMMENT ON TABLE public.place_cache IS 'Google Place Details 캐시. place_id 기준 조회/저장, Geocoding/Place Details 호출 절감.';

ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

-- 읽기: 인증된 사용자
CREATE POLICY "place_cache 읽기 인증 사용자"
  ON public.place_cache FOR SELECT
  TO authenticated
  USING (true);

-- 삽입/수정: 인증된 사용자 (앱에서 Place Details 조회 후 캐시 저장)
CREATE POLICY "place_cache 삽입 인증 사용자"
  ON public.place_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "place_cache 수정 인증 사용자"
  ON public.place_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
