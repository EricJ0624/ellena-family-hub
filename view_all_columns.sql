-- memory_vault 테이블의 모든 컬럼 확인
-- Supabase SQL Editor에서 실행하세요

SELECT 
  column_name AS "컬럼명",
  data_type AS "데이터 타입",
  is_nullable AS "NULL 허용",
  column_default AS "기본값"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'memory_vault'
ORDER BY ordinal_position;






























