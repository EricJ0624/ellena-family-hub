-- Allow travel_diary_entry attachments (remote table: public.attachments)
begin;

alter table public.attachments
  drop constraint if exists feature_attachments_entity_type_check;

alter table public.attachments
  add constraint feature_attachments_entity_type_check
  check (
    entity_type in (
      'chat_message',
      'piggy_wallet_tx',
      'piggy_bank_tx',
      'travel_trip',
      'travel_expense',
      'travel_diary_entry'
    )
  );

commit;
