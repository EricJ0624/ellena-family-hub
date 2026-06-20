-- groups.preferred_language 폐기 (앱 UI 언어는 profiles.preferred_language만 사용)
ALTER TABLE public.groups DROP COLUMN IF EXISTS preferred_language;
