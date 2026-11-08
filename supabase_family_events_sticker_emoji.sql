-- 키즈 캘린더: 사용자가 고른 이모지. 비어 있으면 제목 단어 스티커를 유지한다.

ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS sticker_emoji text;

COMMENT ON COLUMN public.family_events.sticker_emoji IS '키즈 캘린더 날짜 칸에 직접 고른 이모지. 비어 있으면 제목 단어 스티커.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_events_sticker_emoji_len'
  ) THEN
    ALTER TABLE public.family_events
      ADD CONSTRAINT family_events_sticker_emoji_len
      CHECK (sticker_emoji IS NULL OR char_length(sticker_emoji) BETWEEN 1 AND 8);
  END IF;
END $$;
