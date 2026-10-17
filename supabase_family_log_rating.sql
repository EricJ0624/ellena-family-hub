-- Family log place rating and revisit, matching the diary edit fields.

alter table public.family_log_cards
  add column if not exists rating smallint;

alter table public.family_log_cards
  drop constraint if exists family_log_cards_rating_check;

alter table public.family_log_cards
  add constraint family_log_cards_rating_check
  check (rating is null or (rating >= 1 and rating <= 5));

alter table public.family_log_cards
  add column if not exists is_revisit boolean not null default false;
