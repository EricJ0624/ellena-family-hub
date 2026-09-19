-- family_album_items: 세로 사진 object-position y % (가족 위치 타원 등)
-- NULL = 사용자 미저장 (표시 시 FaceDetector/fallback 사용)

ALTER TABLE public.family_album_items
  ADD COLUMN IF NOT EXISTS focus_y smallint NULL;

ALTER TABLE public.family_album_items
  DROP CONSTRAINT IF EXISTS family_album_items_focus_y_range;

ALTER TABLE public.family_album_items
  ADD CONSTRAINT family_album_items_focus_y_range
  CHECK (focus_y IS NULL OR (focus_y >= 0 AND focus_y <= 100));

COMMENT ON COLUMN public.family_album_items.focus_y IS
  'Optional vertical object-position % (0=top, 100=bottom) for portrait crop. NULL = not user-saved yet.';
