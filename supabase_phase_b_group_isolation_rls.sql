-- Phase B: 그룹 격리 강화
-- 1) piggy_open_approvals INSERT에 요청 그룹 멤버십 검사
-- 2) group_id IS NULL 허용 제거 (컬럼은 이미 NOT NULL)

-- ========== piggy_open_approvals INSERT ==========
DROP POLICY IF EXISTS "piggy_open_approvals_insert_member" ON public.piggy_open_approvals;
CREATE POLICY "piggy_open_approvals_insert_member"
  ON public.piggy_open_approvals
  FOR INSERT
  WITH CHECK (
    approver_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.piggy_open_requests r
      WHERE r.id = request_id
        AND (
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.group_id = r.group_id AND m.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = r.group_id AND g.owner_id = auth.uid()
          )
        )
    )
  );

-- ========== SELECT: group_id IS NULL 제거 ==========
DROP POLICY IF EXISTS "family_tasks 읽기 - 그룹 멤버만" ON public.family_tasks;
CREATE POLICY "family_tasks 읽기 - 그룹 멤버만"
  ON public.family_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_tasks.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_tasks.group_id AND g.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_events 읽기 - 그룹 멤버만" ON public.family_events;
CREATE POLICY "family_events 읽기 - 그룹 멤버만"
  ON public.family_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_events.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_events.group_id AND g.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_album_items 읽기 - 그룹 멤버만" ON public.family_album_items;
CREATE POLICY "family_album_items 읽기 - 그룹 멤버만"
  ON public.family_album_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_album_items.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_album_items.group_id AND g.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_chat_messages 읽기 - 그룹 멤버만" ON public.family_chat_messages;
CREATE POLICY "family_chat_messages 읽기 - 그룹 멤버만"
  ON public.family_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_chat_messages.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_chat_messages.group_id AND g.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family_chat_messages 수정 - 본인만" ON public.family_chat_messages;
CREATE POLICY "family_chat_messages 수정 - 본인만"
  ON public.family_chat_messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_chat_messages.group_id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_chat_messages.group_id AND g.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_chat_messages.group_id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_chat_messages.group_id AND g.owner_id = auth.uid()
      )
    )
  );

-- ========== RESTRICTIVE not_suspended: group_id IS NULL 제거 ==========
-- picture_find_scenes 제외: group_id NULL 시스템 씬 존재
-- 공통 패턴: AS RESTRICTIVE FOR ALL TO authenticated

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attachments',
    'family_album_items',
    'family_chat_messages',
    'family_events',
    'family_game_sessions',
    'family_tasks',
    'location_requests',
    'member_support_tickets',
    'notification_preferences',
    'notifications',
    'picture_find_attempts',
    'picture_find_puzzles',
    'piggy_account_requests',
    'piggy_bank_accounts',
    'piggy_bank_transactions',
    'piggy_open_requests',
    'piggy_wallet_transactions',
    'piggy_wallets',
    'travel_accommodations',
    'travel_attractions',
    'travel_day_titles',
    'travel_diary_entries',
    'travel_dining',
    'travel_expenses',
    'travel_itineraries',
    'travel_place_feedback',
    'travel_transports',
    'travel_trip_participants',
    'travel_trips',
    'user_locations',
    'widget_configs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_not_suspended', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT is_user_suspended_in_group(auth.uid(), group_id)) WITH CHECK (NOT is_user_suspended_in_group(auth.uid(), group_id))',
      t || '_not_suspended',
      t
    );
  END LOOP;
END $$;
