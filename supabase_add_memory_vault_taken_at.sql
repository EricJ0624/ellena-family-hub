-- memory_vault에 촬영일(taken_at) 컬럼 추가 (선택)
-- EXIF 또는 파일명에서 추출한 촬영 시각. NULL이면 "날짜 없음"으로 표시

ALTER TABLE memory_vault
ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN memory_vault.taken_at IS '촬영일시(EXIF/파일명에서 추출). NULL=날짜 없음';

SELECT 'memory_vault에 taken_at 컬럼이 추가되었습니다.' AS message;
