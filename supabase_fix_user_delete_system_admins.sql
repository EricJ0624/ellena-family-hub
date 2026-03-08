-- auth.users 사용자 삭제 시 "Database error deleting user" 방지
-- system_admins.created_by FK에 ON DELETE SET NULL 추가 (Supabase SQL Editor에서 실행)

ALTER TABLE public.system_admins
  DROP CONSTRAINT IF EXISTS system_admins_created_by_fkey;

ALTER TABLE public.system_admins
  ADD CONSTRAINT system_admins_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
