-- groups 테이블에 대시보드 UI 테마 컬럼 추가
-- stable_glass: 현재 운영 중인 기본 테마
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
      ADD COLUMN ui_theme TEXT NOT NULL DEFAULT 'stable_glass';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_ui_theme_check'
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_ui_theme_check
      CHECK (ui_theme IN ('stable_glass', 'highend_glass'));
  END IF;
END $$;

COMMENT ON COLUMN public.groups.ui_theme IS '그룹 대시보드 UI 테마 (stable_glass | highend_glass)';
