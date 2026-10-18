-- 앱별 요금과 결제 원장.
-- groups.storage_quota_bytes 기본값(5GB)은 변경하지 않는다.
-- 쓰기는 service_role만. 인증 사용자는 본인·소유 그룹 행만 읽는다.

CREATE TABLE IF NOT EXISTS public.billing_plans (
  app_id text PRIMARY KEY
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  included_seats integer NOT NULL DEFAULT 2 CHECK (included_seats >= 1),
  base_quota_bytes bigint NOT NULL DEFAULT 5368709120 CHECK (base_quota_bytes > 0),
  upgraded_quota_bytes bigint NOT NULL DEFAULT 21474836480 CHECK (upgraded_quota_bytes > base_quota_bytes),
  beta_free_seats integer NOT NULL DEFAULT 2 CHECK (beta_free_seats >= 1),
  beta_free_quota_bytes bigint NOT NULL DEFAULT 524288000 CHECK (beta_free_quota_bytes > 0),
  base_price_cents integer NOT NULL DEFAULT 100 CHECK (base_price_cents >= 0),
  extra_seat_price_cents integer NOT NULL DEFAULT 100 CHECK (extra_seat_price_cents >= 0),
  storage_upgrade_price_cents integer NOT NULL DEFAULT 100 CHECK (storage_upgrade_price_cents >= 0),
  beta_discount_percent integer NOT NULL DEFAULT 50 CHECK (beta_discount_percent BETWEEN 0 AND 100),
  beta_period_enabled boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'usd',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_plans IS
  '앱별 월 구독 요금. 기본 2명·5GB, 추가 인원, 20GB 추가, 베타 할인율. 다른 앱은 이 행만 바꾼다.';

INSERT INTO public.billing_plans (app_id)
VALUES
  ('hearth_family'),
  ('hearth_couple'),
  ('hearth_biker'),
  ('hearth_camper')
ON CONFLICT (app_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  revenuecat_app_user_id text NOT NULL,
  beta_discount_lifetime boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, group_id),
  UNIQUE (app_id, user_id, group_id)
);

COMMENT ON TABLE public.billing_customers IS
  '그룹 오너 결제 고객. RevenueCat 사용자 ID는 앱ID:사용자UUID.';

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'billing_issue')),
  seat_count integer NOT NULL CHECK (seat_count >= 1),
  quota_bytes bigint NOT NULL CHECK (quota_bytes > 0),
  store text NOT NULL
    CHECK (store IN ('test_store', 'play_store')),
  current_period_end timestamptz,
  revenuecat_entitlement_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, group_id)
);

COMMENT ON TABLE public.billing_subscriptions IS
  '그룹당 현재 구독. 인원수와 용량은 이 행이 확정된 뒤에만 그룹 한도에 반영한다.';

CREATE TABLE IF NOT EXISTS public.billing_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  code text NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions >= 1),
  redeemed_count integer NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, code)
);

COMMENT ON TABLE public.billing_promo_codes IS
  '베타 50% 자격 코드. 그룹 오너 화면에 표시한다. 코드 입력만으로 용량은 바뀌지 않는다.';

CREATE TABLE IF NOT EXISTS public.billing_promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  code_id uuid NOT NULL REFERENCES public.billing_promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, group_id)
);

COMMENT ON TABLE public.billing_promo_redemptions IS
  '그룹당 할인코드 1회. 결제 성공 전에도 자격만 남긴다.';

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    CHECK (app_id IN ('hearth_family', 'hearth_couple', 'hearth_biker', 'hearth_camper')),
  event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, event_id)
);

COMMENT ON TABLE public.billing_webhook_events IS
  'RevenueCat 웹훅 중복 처리 방지. 클라이언트는 읽지 않는다.';

CREATE INDEX IF NOT EXISTS idx_billing_customers_user
  ON public.billing_customers (app_id, user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user
  ON public.billing_subscriptions (app_id, user_id);
CREATE INDEX IF NOT EXISTS idx_billing_promo_codes_group
  ON public.billing_promo_codes (app_id, group_id);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_promo_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_promo_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.billing_plans TO service_role;
GRANT ALL ON TABLE public.billing_customers TO service_role;
GRANT ALL ON TABLE public.billing_subscriptions TO service_role;
GRANT ALL ON TABLE public.billing_promo_codes TO service_role;
GRANT ALL ON TABLE public.billing_promo_redemptions TO service_role;
GRANT ALL ON TABLE public.billing_webhook_events TO service_role;

GRANT SELECT ON TABLE public.billing_plans TO authenticated;
GRANT SELECT ON TABLE public.billing_customers TO authenticated;
GRANT SELECT ON TABLE public.billing_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.billing_promo_codes TO authenticated;
GRANT SELECT ON TABLE public.billing_promo_redemptions TO authenticated;

DROP POLICY IF EXISTS billing_plans_select_authenticated ON public.billing_plans;
CREATE POLICY billing_plans_select_authenticated
  ON public.billing_plans
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS billing_customers_select_own ON public.billing_customers;
CREATE POLICY billing_customers_select_own
  ON public.billing_customers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_subscriptions_select_own ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_select_own
  ON public.billing_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS billing_promo_codes_select_owner ON public.billing_promo_codes;
CREATE POLICY billing_promo_codes_select_owner
  ON public.billing_promo_codes
  FOR SELECT
  TO authenticated
  USING (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = billing_promo_codes.group_id
        AND g.owner_id = auth.uid()
        AND g.app_id = billing_promo_codes.app_id
    )
  );

DROP POLICY IF EXISTS billing_promo_redemptions_select_own ON public.billing_promo_redemptions;
CREATE POLICY billing_promo_redemptions_select_own
  ON public.billing_promo_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
