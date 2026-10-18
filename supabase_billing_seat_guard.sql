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

DROP TRIGGER IF EXISTS memberships_billing_seat ON public.memberships;
CREATE TRIGGER memberships_billing_seat
  BEFORE INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_billing_seat_on_membership();
