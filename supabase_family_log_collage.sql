-- Family log card collage slots and vertical crop. Diary tables are unchanged.

alter table public.family_log_cards
  add column if not exists collage_attachment_ids jsonb,
  add column if not exists photo_focus jsonb not null default '{}'::jsonb;

comment on column public.family_log_cards.collage_attachment_ids is
  'Up to 9 attachment ids shown on the family log card. null = first photos.';
comment on column public.family_log_cards.photo_focus is
  'Per-attachment object-position focus. Shape: { [attachmentId]: { y: 0-100 } }.';
