-- 계정 삭제 시 가족 공유 기록은 남기고 작성자만 비움 (ON DELETE SET NULL)
-- 개인 데이터(profiles, memberships, 위치, 푸시 등)는 기존 CASCADE 유지
-- 적용: MCP apply_migration 또는 Supabase SQL Editor

-- 채팅: sender_id NOT NULL → NULL 허용
ALTER TABLE public.family_chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.family_chat_messages
  DROP CONSTRAINT IF EXISTS family_messages_sender_id_fkey;

ALTER TABLE public.family_chat_messages
  ADD CONSTRAINT family_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 일정
ALTER TABLE public.family_events DROP CONSTRAINT IF EXISTS family_events_created_by_fkey;
ALTER TABLE public.family_events
  ADD CONSTRAINT family_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 할 일
ALTER TABLE public.family_tasks DROP CONSTRAINT IF EXISTS family_tasks_assigned_to_fkey;
ALTER TABLE public.family_tasks
  ADD CONSTRAINT family_tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.family_tasks DROP CONSTRAINT IF EXISTS family_tasks_created_by_fkey;
ALTER TABLE public.family_tasks
  ADD CONSTRAINT family_tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 앨범
ALTER TABLE public.family_album_items DROP CONSTRAINT IF EXISTS memory_vault_uploader_id_fkey;
ALTER TABLE public.family_album_items
  ADD CONSTRAINT memory_vault_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 채팅·여행 첨부 파일: 업로드한 사람만 비움 (파일·행 유지)
ALTER TABLE public.attachments
  ALTER COLUMN uploader_id DROP NOT NULL;

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS feature_attachments_uploader_id_fkey;
ALTER TABLE public.attachments
  ADD CONSTRAINT feature_attachments_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 여행: 일정은 남기고 작성자만 비움 (기존 CASCADE는 여행 전체를 지움)
ALTER TABLE public.travel_trips
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.travel_trips DROP CONSTRAINT IF EXISTS travel_trips_created_by_fkey;
ALTER TABLE public.travel_trips
  ADD CONSTRAINT travel_trips_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_trips DROP CONSTRAINT IF EXISTS travel_trips_updated_by_fkey;
ALTER TABLE public.travel_trips
  ADD CONSTRAINT travel_trips_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_trips DROP CONSTRAINT IF EXISTS travel_trips_deleted_by_fkey;
ALTER TABLE public.travel_trips
  ADD CONSTRAINT travel_trips_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_created_by_fkey;
ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_updated_by_fkey;
ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_deleted_by_fkey;
ALTER TABLE public.travel_itineraries
  ADD CONSTRAINT travel_itineraries_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_created_by_fkey;
ALTER TABLE public.travel_expenses
  ADD CONSTRAINT travel_expenses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_paid_by_fkey;
ALTER TABLE public.travel_expenses
  ADD CONSTRAINT travel_expenses_paid_by_fkey
  FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_updated_by_fkey;
ALTER TABLE public.travel_expenses
  ADD CONSTRAINT travel_expenses_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_deleted_by_fkey;
ALTER TABLE public.travel_expenses
  ADD CONSTRAINT travel_expenses_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_created_by_fkey;
ALTER TABLE public.travel_dining
  ADD CONSTRAINT travel_dining_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_updated_by_fkey;
ALTER TABLE public.travel_dining
  ADD CONSTRAINT travel_dining_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_deleted_by_fkey;
ALTER TABLE public.travel_dining
  ADD CONSTRAINT travel_dining_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_created_by_fkey;
ALTER TABLE public.travel_accommodations
  ADD CONSTRAINT travel_accommodations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_updated_by_fkey;
ALTER TABLE public.travel_accommodations
  ADD CONSTRAINT travel_accommodations_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_deleted_by_fkey;
ALTER TABLE public.travel_accommodations
  ADD CONSTRAINT travel_accommodations_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
