-- 정지된 회원/그룹은 가족 기능 테이블을 읽거나 쓰지 못함.
-- 시스템 관리자는 is_user_suspended_in_group 이 false 를 반환하므로 예외.
-- memberships / groups 는 탈퇴·목록용으로 그대로 둔다.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'family_chat_messages',
    'family_events',
    'family_tasks',
    'family_album_items',
    'location_requests',
    'user_locations',
    'widget_configs',
    'notifications',
    'notification_preferences',
    'attachments',
    'family_game_sessions',
    'member_support_tickets',
    'piggy_account_requests',
    'piggy_bank_accounts',
    'piggy_bank_transactions',
    'piggy_wallets',
    'piggy_wallet_transactions',
    'piggy_open_requests',
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
    'picture_find_attempts',
    'picture_find_puzzles',
    'picture_find_scenes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_not_suspended', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (group_id IS NULL OR NOT public.is_user_suspended_in_group(auth.uid(), group_id)) WITH CHECK (group_id IS NULL OR NOT public.is_user_suspended_in_group(auth.uid(), group_id))',
      t || '_not_suspended',
      t
    );
  END LOOP;
END $$;
