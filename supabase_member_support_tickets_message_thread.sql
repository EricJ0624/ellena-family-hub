-- 멤버↔그룹관리자 문의: 첫 답변 이후 추가 문의/답변 스레드
-- 각 항목: { "role": "member" | "group_admin", "user_id": uuid, "body": string, "created_at": iso8601 }

ALTER TABLE public.member_support_tickets
  ADD COLUMN IF NOT EXISTS message_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.member_support_tickets.message_thread IS
  '첫 답변(answer) 이후 이어지는 추가 문의 및 재답변. role은 member 또는 group_admin.';
