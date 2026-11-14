-- 아기 사진 개월 표시용 촬영일. 없으면 개월을 보여 주지 않는다.
alter table public.attachments
  add column if not exists taken_at timestamptz;
