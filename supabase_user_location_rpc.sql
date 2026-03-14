-- RPC 함수: user_locations upsert (RLS 우회)
-- 클라이언트 측 RLS 문제 해결을 위한 서버 측 함수

CREATE OR REPLACE FUNCTION public.upsert_user_location(
  p_user_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_address TEXT,
  p_last_updated TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- 함수 소유자 권한으로 실행 (RLS 우회)
AS $$
BEGIN
  -- 현재 인증된 사용자가 p_user_id와 일치하는지 확인
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  -- user_locations 테이블에 upsert
  INSERT INTO public.user_locations (user_id, latitude, longitude, address, last_updated)
  VALUES (p_user_id, p_latitude, p_longitude, p_address, p_last_updated)
  ON CONFLICT (user_id)
  DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    address = EXCLUDED.address,
    last_updated = EXCLUDED.last_updated;
END;
$$;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.upsert_user_location(UUID, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.upsert_user_location IS 'Insert or update user location. SECURITY DEFINER to bypass client-side RLS issues.';
