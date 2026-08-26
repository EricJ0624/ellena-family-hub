-- Diary collage: per-attachment vertical focus (object-position y %)
-- Shape: { "<attachment_uuid>": { "y": 0-100 } }

alter table public.travel_diary_entries
  add column if not exists photo_focus jsonb not null default '{}'::jsonb;

comment on column public.travel_diary_entries.photo_focus is
  'Per-attachment object-position focus for diary collage. Shape: { [attachmentId]: { y: 0-100 } }.';
