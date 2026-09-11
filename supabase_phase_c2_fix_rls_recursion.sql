-- Phase C-2 hotfix: RLS recursion (groups ↔ memberships ↔ child tables)
-- Cause: RESTRICTIVE policies used EXISTS(SELECT … FROM groups) while groups
-- policies use EXISTS(SELECT … FROM memberships) → infinite recursion / empty {}.
-- Fix: denormalized app_id = 'hearth_family' where column exists;
--      otherwise SECURITY DEFINER is_hearth_family_group(group_id).

CREATE OR REPLACE FUNCTION public.is_hearth_family_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_group_id
      AND g.app_id = 'hearth_family'
  );
$$;

REVOKE ALL ON FUNCTION public.is_hearth_family_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hearth_family_group(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "groups_family_app_only" ON public.groups;
CREATE POLICY "groups_family_app_only"
  ON public.groups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (app_id = 'hearth_family')
  WITH CHECK (app_id = 'hearth_family');

DO $$
DECLARE
  t text;
  has_app_id boolean;
  tables text[] := ARRAY[
    'account_suspensions',
    'admin_audit_log',
    'attachments',
    'dashboard_access_requests',
    'family_album_items',
    'family_chat_messages',
    'family_events',
    'family_game_sessions',
    'family_tasks',
    'feature_usage_snapshots',
    'group_email_invites',
    'location_requests',
    'member_support_tickets',
    'memberships',
    'moderation_threads',
    'notification_preferences',
    'notifications',
    'picture_find_attempts',
    'picture_find_puzzles',
    'picture_find_scenes',
    'piggy_account_requests',
    'piggy_bank_accounts',
    'piggy_bank_transactions',
    'piggy_bank_transactions_archive',
    'piggy_deleted_account_snapshots',
    'piggy_open_requests',
    'piggy_wallet_transactions',
    'piggy_wallet_transactions_archive',
    'piggy_wallets',
    'support_tickets',
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
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'group_id'
    ) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'app_id'
    ) INTO has_app_id;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_family_app_only', t);

    IF has_app_id THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (app_id = %L)
           WITH CHECK (app_id = %L)',
        t || '_family_app_only', t, 'hearth_family', 'hearth_family'
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (group_id IS NULL OR public.is_hearth_family_group(group_id))
           WITH CHECK (group_id IS NULL OR public.is_hearth_family_group(group_id))',
        t || '_family_app_only', t
      );
    END IF;
  END LOOP;
END $$;
