-- baby_growth 위젯 사진 첨부 허용 (public.attachments)
-- 가족 앨범(family_album_items) 자동 동기화는 하지 않음

begin;

alter table public.attachments
  drop constraint if exists feature_attachments_feature_type_check;

alter table public.attachments
  add constraint feature_attachments_feature_type_check
  check (
    feature_type = any (array[
      'chat'::text,
      'piggy'::text,
      'travel'::text,
      'support'::text,
      'family_log'::text,
      'baby_growth'::text
    ])
  );

alter table public.attachments
  drop constraint if exists feature_attachments_entity_type_check;

alter table public.attachments
  add constraint feature_attachments_entity_type_check
  check (
    entity_type = any (array[
      'chat_message'::text,
      'piggy_wallet_tx'::text,
      'piggy_bank_tx'::text,
      'travel_trip'::text,
      'travel_expense'::text,
      'travel_diary_entry'::text,
      'member_support_ticket'::text,
      'support_ticket'::text,
      'family_log_card'::text,
      'family_log_receipt'::text,
      'baby_profile'::text
    ])
  );

commit;
