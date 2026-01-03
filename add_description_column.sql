-- memory_vault 테이블에 description 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 확인: 컬럼이 추가되었는지 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memory_vault' 
  AND table_schema = 'public'
  AND column_name = 'description';

