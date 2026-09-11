-- Phase D-1: 멀티 앱 4종 RLS + create_group(app_id)
-- hearth_family | hearth_couple | hearth_biker | hearth_camper
-- 앱 간 격리는 CURRENT_APP_ID 필터(클라/API) + 멤버십.

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_app_id_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_app_id_check
  CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'));

CREATE OR REPLACE FUNCTION public.is_hearth_app_group(p_group_id uuid)
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
      AND g.app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')
  );
$$;

REVOKE ALL ON FUNCTION public.is_hearth_app_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hearth_app_group(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_hearth_family_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT public.is_hearth_app_group(p_group_id);
$$;

DROP POLICY IF EXISTS "groups_family_app_only" ON public.groups;
CREATE POLICY "groups_family_app_only"
  ON public.groups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'))
  WITH CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'));

DO $$
DECLARE
  t text;
  has_app_id boolean;
  tables text[] := ARRAY[
    'account_suspensions', 'admin_audit_log', 'attachments', 'dashboard_access_requests',
    'family_album_items', 'family_chat_messages', 'family_events', 'family_game_sessions',
    'family_tasks', 'feature_usage_snapshots', 'group_email_invites', 'location_requests',
    'member_support_tickets', 'memberships', 'moderation_threads', 'notification_preferences',
    'notifications', 'picture_find_attempts', 'picture_find_puzzles', 'picture_find_scenes',
    'piggy_account_requests', 'piggy_bank_accounts', 'piggy_bank_transactions',
    'piggy_bank_transactions_archive', 'piggy_deleted_account_snapshots', 'piggy_open_requests',
    'piggy_wallet_transactions', 'piggy_wallet_transactions_archive', 'piggy_wallets',
    'support_tickets', 'travel_accommodations', 'travel_attractions', 'travel_day_titles',
    'travel_diary_entries', 'travel_dining', 'travel_expenses', 'travel_itineraries',
    'travel_place_feedback', 'travel_transports', 'travel_trip_participants', 'travel_trips',
    'user_locations', 'widget_configs'
  ];
  allowed constant text := $allowed$'hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper'$allowed$;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'group_id'
    ) THEN CONTINUE; END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'app_id'
    ) INTO has_app_id;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_family_app_only', t);

    IF has_app_id THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (app_id IN (%s))
           WITH CHECK (app_id IN (%s))',
        t || '_family_app_only', t, allowed, allowed
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
           USING (group_id IS NULL OR public.is_hearth_app_group(group_id))
           WITH CHECK (group_id IS NULL OR public.is_hearth_app_group(group_id))',
        t || '_family_app_only', t
      );
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.create_group(text, text);
DROP FUNCTION IF EXISTS public.create_group(text, text, uuid);
DROP FUNCTION IF EXISTS public.create_group(text, text, uuid, boolean);
DROP FUNCTION IF EXISTS public.create_group(text, text, uuid, boolean, text);

CREATE FUNCTION public.create_group(
  group_name text,
  invite_code_param text,
  owner_id_param uuid DEFAULT NULL,
  display_name_pending_param boolean DEFAULT false,
  app_id_param text DEFAULT 'hearth_family'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  new_group_id UUID;
  current_uid UUID;
  final_owner_id UUID;
  final_name TEXT;
  final_pending BOOLEAN;
  final_app_id TEXT;
  owned_count INTEGER;
BEGIN
  current_uid := auth.uid();
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  final_app_id := COALESCE(NULLIF(trim(app_id_param), ''), 'hearth_family');
  IF final_app_id NOT IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper') THEN
    RAISE EXCEPTION 'invalid app_id';
  END IF;

  IF owner_id_param IS NOT NULL THEN
    IF owner_id_param != current_uid THEN
      RAISE EXCEPTION 'owner_id must match authenticated user';
    END IF;
    final_owner_id := owner_id_param;
  ELSE
    final_owner_id := current_uid;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(current_uid::text || ':' || final_app_id, 0));

  IF NOT public.is_system_admin(current_uid)
     AND public.user_has_only_suspended_groups(current_uid) THEN
    RAISE EXCEPTION 'ALL_GROUPS_SUSPENDED';
  END IF;

  SELECT count(*)::integer INTO owned_count
  FROM public.groups g
  WHERE g.owner_id = final_owner_id AND g.app_id = final_app_id;

  IF NOT public.is_system_admin(current_uid) AND owned_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.owner_id = final_owner_id
        AND g.app_id = final_app_id
        AND g.created_at > (now() - interval '15 seconds')
    ) THEN
      RAISE EXCEPTION 'GROUP_CREATE_BURST';
    END IF;
  END IF;

  final_pending := COALESCE(display_name_pending_param, false);
  IF final_pending THEN
    final_name := '__display_name_pending__';
  ELSE
    final_name := NULLIF(trim(group_name), '');
    IF final_name IS NULL THEN
      RAISE EXCEPTION 'group_name is required when display_name_pending is false';
    END IF;
  END IF;

  INSERT INTO public.groups (name, invite_code, owner_id, display_name_pending, app_id)
  VALUES (final_name, invite_code_param, final_owner_id, final_pending, final_app_id)
  RETURNING id INTO new_group_id;

  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (final_owner_id, new_group_id, 'ADMIN')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN new_group_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid, boolean, text) TO authenticated, service_role;
