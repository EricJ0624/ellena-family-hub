-- memory_vault에서 Cloudinary 관련 컬럼 제거 (앱에서 Cloudinary 완전 제거)
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.memory_vault
  DROP COLUMN IF EXISTS cloudinary_url;

ALTER TABLE public.memory_vault
  DROP COLUMN IF EXISTS cloudinary_public_id;

SELECT 'memory_vault에서 cloudinary_url, cloudinary_public_id 컬럼이 제거되었습니다.' AS message;
