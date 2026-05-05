-- groups 테이블에 대시보드 UI 테마 컬럼 추가
-- default: 테마 적용 전 오리지널 설정
-- stable_glass: 안정형 글래스 테마
-- highend_glass: 강화 글래스모피즘 테마

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'groups'
      AND column_name = 'ui_theme'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN ui_theme TEXT NOT NULL DEFAULT 'default';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_ui_theme_check'
  ) THEN
    ALTER TABLE public.groups
      DROP CONSTRAINT groups_ui_theme_check;
  END IF;
END $$;

UPDATE public.groups
SET ui_theme = 'default'
WHERE ui_theme = 'stable_glass';

ALTER TABLE public.groups
  ALTER COLUMN ui_theme SET DEFAULT 'default';

ALTER TABLE public.groups
  ADD CONSTRAINT groups_ui_theme_check
  CHECK (ui_theme IN ('default', 'stable_glass', 'highend_glass'));

COMMENT ON COLUMN public.groups.ui_theme IS '그룹 대시보드 UI 테마 (default | stable_glass | highend_glass)';
