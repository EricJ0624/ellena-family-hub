-- memory_vault 테이블 구조 확인
-- Supabase SQL Editor에서 실행하세요

-- 테이블 컬럼 정보 조회
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'memory_vault'
ORDER BY ordinal_position;































