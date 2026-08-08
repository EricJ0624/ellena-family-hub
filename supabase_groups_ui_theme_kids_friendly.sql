-- groups.ui_theme: stable_glass → kids_friendly 리네임
-- Kids Friendly를 새 그룹 기본값으로 설정
-- highend_glass / default 의미는 앱에서 재정의 (글래스는 highend 전용)

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
SET ui_theme = 'kids_friendly'
WHERE ui_theme = 'stable_glass';

ALTER TABLE public.groups
  ALTER COLUMN ui_theme SET DEFAULT 'kids_friendly';

ALTER TABLE public.groups
  ADD CONSTRAINT groups_ui_theme_check
  CHECK (ui_theme IN ('default', 'kids_friendly', 'highend_glass'));

COMMENT ON COLUMN public.groups.ui_theme IS
  '그룹 대시보드 UI 테마 (default=original | kids_friendly | highend_glass)';
