-- memberships 테이블에 가족 표시 역할 컬럼 추가 (선택사항)
-- 소유자/관리자: mom, dad | 멤버: son, daughter, other
-- NULL 허용: 미설정 시 지도 등에서 "기타"와 동일 처리

ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS family_role TEXT DEFAULT NULL;

ALTER TABLE memberships
DROP CONSTRAINT IF EXISTS memberships_family_role_check;

ALTER TABLE memberships
ADD CONSTRAINT memberships_family_role_check
CHECK (family_role IS NULL OR family_role IN ('mom', 'dad', 'son', 'daughter', 'other'));

COMMENT ON COLUMN memberships.family_role IS '가족 표시 역할(선택). 소유자/관리자: mom, dad. 멤버: son, daughter, other. NULL=미설정(기타와 동일)';

SELECT 'memberships 테이블에 family_role 컬럼이 추가되었습니다.' AS message;
