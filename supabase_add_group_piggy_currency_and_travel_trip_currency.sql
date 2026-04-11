-- Piggy Bank 그룹 기본 통화 + 여행 플래너 트립 기준 통화
-- Supabase SQL Editor 또는 마이그레이션 파이프라인에서 실행하세요.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS piggy_currency TEXT NOT NULL DEFAULT 'KRW';

ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW';

COMMENT ON COLUMN public.groups.piggy_currency IS 'Piggy Bank 통화 (그룹 관리자 설정, 저금통 계정과 동기화)';
COMMENT ON COLUMN public.travel_trips.currency IS '여행 기준 통화 (관리자 생성·변경 시 경비 행과 통일)';
