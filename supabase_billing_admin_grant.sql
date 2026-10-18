-- 시스템 관리자가 정한 용량·무료 사용. 그룹 관리자의 groups 수정으로는 바꿀 수 없다.
-- 초대코드 생성과 groups.storage_quota_bytes 기본값(5GB)은 바꾸지 않는다.

CREATE TABLE IF NOT EXISTS public.billing_group_overrides (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  quota_admin_set boolean NOT NULL DEFAULT false,
  billing_comp boolean NOT NULL DEFAULT false,
  comp_seats integer CHECK (comp_seats IS NULL OR comp_seats >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_group_overrides IS
  '시스템 관리자 용량 우선과 결제 없는 사용. 관리자가 용량을 저장한 뒤에만 quota_admin_set이 참이다.';

ALTER TABLE public.billing_group_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_group_overrides_select_member ON public.billing_group_overrides;
CREATE POLICY billing_group_overrides_select_member
  ON public.billing_group_overrides
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

REVOKE ALL ON public.billing_group_overrides FROM PUBLIC, anon;
GRANT SELECT ON public.billing_group_overrides TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'billing_group_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_group_overrides;
  END IF;
END $$;

-- 구독이 없으면 베타 기간에는 기본 2명, 베타가 꺼지면 오너 1명.
-- 시스템 관리자가 무료 사용 인원을 저장한 그룹은 그 인원이 우선한다.
-- 초대코드 생성은 바꾸지 않고, 멤버 행이 생기기 직전에만 검사한다.

CREATE OR REPLACE FUNCTION public.enforce_billing_seat_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed integer := 2;
  v_current integer;
  v_seats integer;
  v_comp boolean;
  v_comp_seats integer;
BEGIN
  SELECT billing_comp, comp_seats
    INTO v_comp, v_comp_seats
  FROM public.billing_group_overrides
  WHERE group_id = NEW.group_id;

  IF v_comp IS TRUE AND v_comp_seats IS NOT NULL THEN
    v_allowed := v_comp_seats;
  ELSE
    SELECT seat_count
      INTO v_seats
    FROM public.billing_subscriptions
    WHERE group_id = NEW.group_id
      AND status = 'active'
    LIMIT 1;

    IF v_seats IS NOT NULL THEN
      v_allowed := v_seats;
    ELSE
      SELECT CASE
        WHEN COALESCE(p.beta_period_enabled, true)
          THEN COALESCE(p.beta_free_seats, p.included_seats, 2)
        ELSE 1
      END
        INTO v_allowed
      FROM public.groups g
      JOIN public.billing_plans p ON p.app_id = g.app_id
      WHERE g.id = NEW.group_id;
      IF v_allowed IS NULL THEN
        v_allowed := 2;
      END IF;
    END IF;
  END IF;

  SELECT count(*)::integer
    INTO v_current
  FROM public.memberships
  WHERE group_id = NEW.group_id;

  IF v_current >= v_allowed THEN
    RAISE EXCEPTION 'BILLING_SEAT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 구독이 없는 베타 오너 그룹의 저장 용량을 500MB로 맞춘다.
-- 제외 테스트 계정, 활성 구독, 이미 관리자가 용량을 정한 그룹은 그대로 둔다.
WITH app_users AS (
  SELECT g.app_id, g.owner_id AS user_id, g.created_at AS at
  FROM public.groups g
  WHERE g.owner_id IS NOT NULL
  UNION ALL
  SELECT COALESCE(m.app_id, g.app_id) AS app_id, m.user_id, m.joined_at AS at
  FROM public.memberships m
  JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id IS NOT NULL
),
earliest AS (
  SELECT app_id, user_id, MIN(at) AS earliest_at
  FROM app_users
  WHERE at IS NOT NULL
  GROUP BY app_id, user_id
),
qualified AS (
  SELECT e.app_id, e.user_id, GREATEST(u.email_confirmed_at, e.earliest_at) AS qualified_at
  FROM earliest e
  JOIN auth.users u ON u.id = e.user_id
  WHERE u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND u.banned_until IS NULL
    AND lower(u.email) NOT IN ('soungtak@gmail.com', 'soungtak@icloud.com')
),
ranked AS (
  SELECT app_id, user_id,
    ROW_NUMBER() OVER (PARTITION BY app_id ORDER BY qualified_at, user_id) AS rank
  FROM qualified
)
UPDATE public.groups g
SET storage_quota_bytes = 524288000
WHERE EXISTS (
  SELECT 1
  FROM ranked r
  WHERE r.app_id = g.app_id
    AND r.user_id = g.owner_id
    AND r.rank <= 100
)
AND NOT EXISTS (
  SELECT 1
  FROM public.billing_subscriptions s
  WHERE s.group_id = g.id
    AND s.status = 'active'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.billing_group_overrides o
  WHERE o.group_id = g.id
    AND o.quota_admin_set
);
