-- groups 테이블에 대시보드 타이틀(가족 이름) 컬럼 추가
-- 그룹 관리자/소유자만 설정 가능, 대시보드에서 표시

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS family_name TEXT;

-- 기존 그룹은 NULL 허용 (NULL이면 대시보드에서 기존 로직 또는 기본값 사용)
COMMENT ON COLUMN groups.family_name IS '대시보드에 표시되는 가족 이름(타이틀). 그룹 관리자/소유자만 수정 가능.';
