-- 소프트 삭제된 정지 문의는 회원 SELECT에서 숨김.
-- 시스템 관리자는 서비스 롤 API로 삭제하며, 브라우저 SELECT는 삭제분 포함 가능.

DROP POLICY IF EXISTS moderation_messages_not_deleted ON public.moderation_messages;
CREATE POLICY moderation_messages_not_deleted
  ON public.moderation_messages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS moderation_threads_not_deleted ON public.moderation_threads;
CREATE POLICY moderation_threads_not_deleted
  ON public.moderation_threads
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL OR public.is_system_admin(auth.uid()));
