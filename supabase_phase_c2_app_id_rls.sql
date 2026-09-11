-- Phase C-2: Family 앱 경계 강화
-- 1) groups RLS에 app_id=hearth_family (RESTRICTIVE)
-- 2) group_id 보유 테이블에 RESTRICTIVE 앱 필터 (기존 정책 유지 + AND)
-- 3) 핵심 테이블 app_id 컬럼 복제 + groups 경유 백필 + INSERT 트리거
-- S3 기존 키 배치 이전은 C-2b (레거시 키 읽기 유지, 대량 복사는 별도 승인)

-- --------------------------------------------------------------------------
-- A. groups: Family 앱만 (동일 DB에 Couple이 생겨도 Family 클라이언트에 안 보임)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "groups_family_app_only" ON public.groups;
CREATE POLICY "groups_family_app_only"
  ON public.groups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (app_id = 'hearth_family')
  WITH CHECK (app_id = 'hearth_family');

-- --------------------------------------------------------------------------
-- B. group_id 테이블: 소속 그룹이 hearth_family 일 때만 (NULL group_id는 시스템 행 허용)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  t text;
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

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_family_app_only', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (
           group_id IS NULL
           OR EXISTS (
             SELECT 1 FROM public.groups g
             WHERE g.id = group_id AND g.app_id = %L
           )
         )
         WITH CHECK (
           group_id IS NULL
           OR EXISTS (
             SELECT 1 FROM public.groups g
             WHERE g.id = group_id AND g.app_id = %L
           )
         )',
      t || '_family_app_only',
      t,
      'hearth_family',
      'hearth_family'
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- C. 핵심 테이블 app_id 복제 (이전·조회 준비). INSERT 시 groups.app_id 복사
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_row_app_id_from_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    SELECT g.app_id INTO NEW.app_id
    FROM public.groups g
    WHERE g.id = NEW.group_id;

    IF NEW.app_id IS NULL THEN
      NEW.app_id := 'hearth_family';
    END IF;
  ELSE
    NEW.app_id := COALESCE(NEW.app_id, 'hearth_family');
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  t text;
  core text[] := ARRAY[
    'memberships',
    'family_album_items',
    'family_chat_messages',
    'family_events',
    'family_tasks',
    'location_requests',
    'notifications',
    'notification_preferences',
    'widget_configs',
    'attachments',
    'travel_trips',
    'user_locations',
    'family_game_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY core
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS app_id text', t);

    EXECUTE format(
      'UPDATE public.%I AS r
         SET app_id = g.app_id
         FROM public.groups g
         WHERE r.group_id = g.id
           AND (r.app_id IS NULL OR r.app_id IS DISTINCT FROM g.app_id)',
      t
    );

    EXECUTE format(
      'UPDATE public.%I SET app_id = %L WHERE app_id IS NULL AND group_id IS NULL',
      t,
      'hearth_family'
    );

    -- group_id 있는데 그룹이 없는 고아 행
    EXECUTE format(
      'UPDATE public.%I SET app_id = %L WHERE app_id IS NULL',
      t,
      'hearth_family'
    );

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN app_id SET DEFAULT %L', t, 'hearth_family');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN app_id SET NOT NULL', t);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (app_id)',
      'idx_' || t || '_app_id',
      t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_app_id_from_group ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_app_id_from_group
         BEFORE INSERT OR UPDATE OF group_id
         ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_row_app_id_from_group()',
      t
    );
  END LOOP;
END $$;
