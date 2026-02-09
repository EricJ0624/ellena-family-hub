-- groups 테이블에 대시보드 타이틀(가족 이름) 컬럼 추가
-- 그룹 관리자/소유자만 설정 가능, 대시보드에서 표시

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS family_name TEXT;

COMMENT ON COLUMN groups.family_name IS '대시보드에 표시되는 가족 이름(타이틀). 그룹 관리자/소유자만 수정 가능.';

-- 대시보드 타이틀 스타일 (색상, 글자체, 크기 등) JSONB
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS title_style JSONB;

COMMENT ON COLUMN groups.title_style IS '대시보드 타이틀 스타일: content, color, fontSize, fontWeight, letterSpacing, fontFamily.';
