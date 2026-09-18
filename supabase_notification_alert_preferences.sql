-- 알림 전달 모드: 유저 + 앱 전역 (group_id 없음)
-- first_mode: voice | vibrate | silent
-- subsequent_mode: vibrate | silent

CREATE TABLE IF NOT EXISTS public.notification_alert_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL DEFAULT 'hearth_family',
  first_mode TEXT NOT NULL DEFAULT 'voice'
    CHECK (first_mode IN ('voice', 'vibrate', 'silent')),
  subsequent_mode TEXT NOT NULL DEFAULT 'silent'
    CHECK (subsequent_mode IN ('vibrate', 'silent')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, app_id)
);

ALTER TABLE public.notification_alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_alert_preferences_select_own" ON public.notification_alert_preferences;
CREATE POLICY "notification_alert_preferences_select_own" ON public.notification_alert_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_alert_preferences_insert_own" ON public.notification_alert_preferences;
CREATE POLICY "notification_alert_preferences_insert_own" ON public.notification_alert_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_alert_preferences_update_own" ON public.notification_alert_preferences;
CREATE POLICY "notification_alert_preferences_update_own" ON public.notification_alert_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_alert_preferences_delete_own" ON public.notification_alert_preferences;
CREATE POLICY "notification_alert_preferences_delete_own" ON public.notification_alert_preferences
  FOR DELETE USING (auth.uid() = user_id);
