-- memberships.family_role 에 할아버지(grandpa), 할머니(grandma) 값 추가
-- 기존: mom, dad, son, daughter, other

ALTER TABLE memberships
DROP CONSTRAINT IF EXISTS memberships_family_role_check;

ALTER TABLE memberships
ADD CONSTRAINT memberships_family_role_check
CHECK (family_role IS NULL OR family_role IN ('mom', 'dad', 'son', 'daughter', 'grandpa', 'grandma', 'other'));

COMMENT ON COLUMN memberships.family_role IS '가족 표시 역할(선택). 소유자/관리자: mom, dad. 멤버: son, daughter, grandpa, grandma, other. NULL=미설정(기타와 동일)';

SELECT 'memberships.family_role에 grandpa, grandma가 추가되었습니다.' AS message;
