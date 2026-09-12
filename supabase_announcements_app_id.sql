-- announcements.app_id: NULL = 전역(모든 앱), 값 = 해당 앱만
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS app_id text;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_app_id_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_app_id_check
  CHECK (
    app_id IS NULL
    OR app_id = ANY (ARRAY['hearth_family'::text, 'hearth_couple'::text, 'hearth_biker'::text, 'hearth_camper'::text])
  );

CREATE INDEX IF NOT EXISTS announcements_app_id_idx
  ON public.announcements (app_id);

COMMENT ON COLUMN public.announcements.app_id IS
  'NULL=all apps (global); otherwise target app_id only';
