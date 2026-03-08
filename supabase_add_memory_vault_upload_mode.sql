-- memory_vault에 업로드 모드(일반/원본) 컬럼 추가
-- 일반(normal): browser-image-compression 압축 후 S3 저장 → 다운로드 시 Cloudinary 변환 경유
-- 원본(original): 원본 파일 S3 저장 → 다운로드 시 CloudFront에서 S3 직접 전달
-- Supabase SQL Editor에서 실행하세요.

-- upload_mode: 'normal' | 'original'
-- NULL = 기존 데이터(마이그레이션 전 레코드), 표시/다운로드 시 앱에서 legacy 처리
ALTER TABLE public.memory_vault
  ADD COLUMN IF NOT EXISTS upload_mode TEXT
  CHECK (upload_mode IS NULL OR upload_mode IN ('normal', 'original'));

COMMENT ON COLUMN public.memory_vault.upload_mode IS '업로드 모드: normal=압축본 S3 저장(다운로드 시 Cloudinary 변환), original=원본 S3 저장(CloudFront 직달). NULL=기존 레코드';

-- 선택: 기존 행을 기본값으로 채우려면 아래 주석 해제
-- UPDATE public.memory_vault SET upload_mode = 'normal' WHERE upload_mode IS NULL;

SELECT 'memory_vault에 upload_mode 컬럼이 추가되었습니다.' AS message;
