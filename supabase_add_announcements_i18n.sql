-- announcements 테이블에 다국어 제목/내용 컬럼 추가 (시스템 어드민 공지)
-- title_i18n, content_i18n: JSONB, 예) { "ko": "...", "en": "..." }
-- 표시 시: 그룹 언어가 있으면 해당 언어, 없으면 영어, 영어도 없으면 첫 번째 값

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT NULL;

COMMENT ON COLUMN announcements.title_i18n IS '다국어 제목. 키: ko, en, ja, zh-CN, zh-TW';
COMMENT ON COLUMN announcements.content_i18n IS '다국어 내용. 키: ko, en, ja, zh-CN, zh-TW';

-- (선택) 기존 행: title/content를 title_i18n.ko, content_i18n.ko로 이전하면 기존 공지도 동일 동작
-- UPDATE announcements SET title_i18n = jsonb_build_object('ko', title), content_i18n = jsonb_build_object('ko', content) WHERE title_i18n IS NULL AND title IS NOT NULL;

SELECT 'announcements 테이블에 title_i18n, content_i18n 컬럼이 추가되었습니다.' AS message;
