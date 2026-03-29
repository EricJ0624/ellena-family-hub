-- 그룹↔시스템 문의: 첫 답변 이후 추가 문의/답변 스레드 (JSON 배열)
-- 각 항목: { "role": "group_admin" | "system_admin", "user_id": uuid, "body": string, "created_at": iso8601 }

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS message_thread jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.support_tickets.message_thread IS
  '첫 답변(answer) 이후 이어지는 추가 문의/답변 목록. role은 group_admin 또는 system_admin.';
