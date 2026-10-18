-- System admin client reads are limited to groups they belong to or have an approved dashboard grant for.
-- The admin group-list screen uses the service-role group-storage API, not these policies.

DROP POLICY IF EXISTS "시스템관리자 그룹 읽기" ON public.groups;
CREATE POLICY "시스템관리자 그룹 읽기"
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    AND public.is_group_member(groups.id, auth.uid())
  );

DROP POLICY IF EXISTS "시스템관리자 멤버십 읽기" ON public.memberships;
CREATE POLICY "시스템관리자 멤버십 읽기"
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    AND public.is_group_member(memberships.group_id, auth.uid())
  );
