-- 켜 둔 화면이 베타 스위치와 구독 변경을 받도록 Realtime에 올린다.
-- 구독 행은 결제 오너와 같은 그룹 멤버가 읽는다. 쓰기는 service_role만 유지한다.

DROP POLICY IF EXISTS billing_subscriptions_select_own ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_select_own
  ON public.billing_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'billing_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'billing_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_subscriptions;
  END IF;
END $$;
