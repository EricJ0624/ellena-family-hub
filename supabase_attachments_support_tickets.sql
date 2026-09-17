-- 문의(멤버/시스템) 스크린샷·사진 첨부용 attachments 타입 확장
-- + 첫 답변 첨부 entity_id 컬럼

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS feature_attachments_feature_type_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT feature_attachments_feature_type_check
  CHECK (feature_type = ANY (ARRAY['chat'::text, 'piggy'::text, 'travel'::text, 'support'::text]));

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS feature_attachments_entity_type_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT feature_attachments_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    'chat_message'::text,
    'piggy_wallet_tx'::text,
    'piggy_bank_tx'::text,
    'travel_trip'::text,
    'travel_expense'::text,
    'travel_diary_entry'::text,
    'member_support_ticket'::text,
    'support_ticket'::text
  ]));

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS answer_message_id uuid;

ALTER TABLE public.member_support_tickets
  ADD COLUMN IF NOT EXISTS answer_message_id uuid;

COMMENT ON COLUMN public.support_tickets.answer_message_id IS
  'First answer attachment entity_id (attachments.entity_type = support_ticket)';

COMMENT ON COLUMN public.member_support_tickets.answer_message_id IS
  'First answer attachment entity_id (attachments.entity_type = member_support_ticket)';
