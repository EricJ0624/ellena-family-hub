-- groups.ui_theme: default 오리지널 테마 도입
-- 기존 stable_glass 값을 default로 이행

UPDATE public.groups
SET ui_theme = 'default'
WHERE ui_theme = 'stable_glass';

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

ALTER TABLE public.groups
  ALTER COLUMN ui_theme SET DEFAULT 'default';

ALTER TABLE public.groups
  ADD CONSTRAINT groups_ui_theme_check
  CHECK (ui_theme IN ('default', 'stable_glass', 'highend_glass'));

COMMENT ON COLUMN public.groups.ui_theme IS '그룹 대시보드 UI 테마 (default | stable_glass | highend_glass)';
