-- groups 테이블에 preferred_language 컬럼 추가 (그룹별 표시 언어: 폰트/타이포 적용용)
-- 값: ko, en, ja, zh-CN, zh-TW. 그룹 생성 시 또는 그룹 관리자 설정에서 지정.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE public.groups
    ADD COLUMN preferred_language TEXT DEFAULT 'ko';

    COMMENT ON COLUMN public.groups.preferred_language IS '그룹 표시 언어 (ko, en, ja, zh-CN, zh-TW). 그룹 관리자가 설정.';
  END IF;
END $$;
