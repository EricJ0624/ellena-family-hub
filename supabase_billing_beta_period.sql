-- 베타 기간 스위치. 기본값은 켜짐. 관리자가 끄면 구독 없는 대시보드 접근을 막는다.
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS beta_period_enabled boolean NOT NULL DEFAULT true;
