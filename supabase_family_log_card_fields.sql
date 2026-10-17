-- Family Log card fields (diary-equivalent) and attachment types.
-- Existing travel/chat/piggy/support attachment values stay in the checks.

alter table public.family_log_cards drop constraint if exists family_log_cards_kind_check;
alter table public.family_log_cards
  add constraint family_log_cards_kind_check
  check (kind in ('checkin', 'route', 'note'));

alter table public.family_log_cards add column if not exists note text;
alter table public.family_log_cards add column if not exists mood_tags jsonb not null default '[]'::jsonb;
alter table public.family_log_cards add column if not exists show_map boolean not null default true;
alter table public.family_log_cards add column if not exists amount numeric;
alter table public.family_log_cards add column if not exists currency text;
alter table public.family_log_cards add column if not exists collage_style text;

alter table public.attachments drop constraint if exists feature_attachments_feature_type_check;
alter table public.attachments
  add constraint feature_attachments_feature_type_check
  check (feature_type in ('chat', 'piggy', 'travel', 'support', 'family_log'));

alter table public.attachments drop constraint if exists feature_attachments_entity_type_check;
alter table public.attachments
  add constraint feature_attachments_entity_type_check
  check (entity_type in (
    'chat_message',
    'piggy_wallet_tx',
    'piggy_bank_tx',
    'travel_trip',
    'travel_expense',
    'travel_diary_entry',
    'member_support_ticket',
    'support_ticket',
    'family_log_card',
    'family_log_receipt'
  ));
