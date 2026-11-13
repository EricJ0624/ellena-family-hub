-- =============================================================================
-- Baby Growth Widget V2 — 추가 기능 마이그레이션
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A-1. baby_daily_logs 컬럼 추가
-- ---------------------------------------------------------------------------

ALTER TABLE baby_daily_logs
  -- 모유 수유 타이머 (왼/오른쪽 독립)
  ADD COLUMN IF NOT EXISTS breast_left_min      smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breast_right_min     smallint DEFAULT 0,
  -- 이유식 재료·알레르기
  ADD COLUMN IF NOT EXISTS solid_ingredients    text,
  ADD COLUMN IF NOT EXISTS allergy_reaction     text,
  -- 배변 색상·상태
  ADD COLUMN IF NOT EXISTS diaper_color         text,
  ADD COLUMN IF NOT EXISTS diaper_consistency   text,
  -- 기타 활동 (목욕/터미타임/유축 등)
  ADD COLUMN IF NOT EXISTS activity_type        text,
  ADD COLUMN IF NOT EXISTS activity_duration_min smallint,
  ADD COLUMN IF NOT EXISTS pump_amount_ml       smallint;

-- ---------------------------------------------------------------------------
-- A-2. baby_checkups — 영유아 검진 결과
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS baby_checkups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id          uuid NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  group_id         uuid NOT NULL,
  checkup_type     text NOT NULL,
  -- 허용값: '1m','2m','4m','6m','9m','12m','15m','18m','24m','36m','48m','54m','60m','66m','72m'
  checkup_date     date NOT NULL,
  weight_kg        numeric(5,3),
  height_cm        numeric(5,1),
  head_cm          numeric(5,1),
  vision_ok        boolean,
  hearing_ok       boolean,
  dev_notes        text,
  doctor_notes     text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE baby_checkups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_member_select_checkups" ON baby_checkups
  FOR SELECT USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_insert_checkups" ON baby_checkups
  FOR INSERT WITH CHECK (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_update_checkups" ON baby_checkups
  FOR UPDATE USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_delete_checkups" ON baby_checkups
  FOR DELETE USING (is_group_member(group_id, auth.uid()));

-- GRANT
GRANT SELECT
  ON public.baby_checkups
  TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.baby_checkups
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.baby_checkups
  TO service_role;

-- ---------------------------------------------------------------------------
-- A-3. baby_reminders — 성장 기록·검진·접종 입력 알림
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS baby_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id         uuid NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  group_id        uuid NOT NULL,
  reminder_type   text NOT NULL,
  -- 허용값: 'growth_record' | 'checkup' | 'vaccination'
  remind_at       timestamptz NOT NULL,
  reference_key   text,
  -- 접종 vaccine_key 또는 검진 checkup_type 등
  is_dismissed    boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE baby_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_member_select_reminders" ON baby_reminders
  FOR SELECT USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_insert_reminders" ON baby_reminders
  FOR INSERT WITH CHECK (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_update_reminders" ON baby_reminders
  FOR UPDATE USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_member_delete_reminders" ON baby_reminders
  FOR DELETE USING (is_group_member(group_id, auth.uid()));

-- GRANT
GRANT SELECT
  ON public.baby_reminders
  TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.baby_reminders
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.baby_reminders
  TO service_role;
