-- memory_vault 테이블에 Cloudinary/S3 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- Cloudinary URL (표시용 최적화된 이미지)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS cloudinary_url TEXT;

-- AWS S3 원본 파일 URL
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS s3_original_url TEXT;

-- 파일 타입 (photo 또는 video)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'photo' 
  CHECK (file_type IN ('photo', 'video'));

-- 원본 파일 크기 (bytes)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS original_file_size BIGINT;

-- Cloudinary Public ID (삭제용)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- AWS S3 Key/Path (원본 파일 삭제용)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- MIME 타입
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 원본 파일명
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- 확인: 컬럼이 추가되었는지 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memory_vault' 
  AND table_schema = 'public'
ORDER BY ordinal_position;














