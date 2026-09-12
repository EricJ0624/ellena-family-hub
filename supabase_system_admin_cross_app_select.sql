-- System admin console: SELECT across all apps' groups/memberships.
-- Write paths remain membership/API guarded. Dashboard group lists stay filtered by CURRENT_APP_ID in app code.

CREATE POLICY "시스템관리자 그룹 읽기"
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "시스템관리자 멤버십 읽기"
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
