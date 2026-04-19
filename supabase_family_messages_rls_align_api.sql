-- family_messages RLS 재적용 (의존 함수 없이 동작)
--
-- 이전 버전은 public.is_system_admin / can_access_group_dashboard 가 없는 프로젝트에서 실패할 수 있음.
-- 일반 가족 계정(멤버십 또는 그룹 소유자) 채팅은 아래 정책만으로 충분합니다.
--
-- 실행 전: public.family_messages 테이블이 있어야 합니다(없으면 여기서 오류 납니다).

ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_messages 읽기 - 그룹 멤버만" ON public.family_messages;
DROP POLICY IF EXISTS "family_messages 작성 - 그룹 멤버만" ON public.family_messages;
DROP POLICY IF EXISTS "family_messages 수정 - 본인만" ON public.family_messages;
DROP POLICY IF EXISTS "family_messages 삭제 - 본인 또는 ADMIN" ON public.family_messages;

-- 읽기: 자신이 속한 그룹의 메시지만 (supabase_multi_tenant_migration.sql 과 동일)
CREATE POLICY "family_messages 읽기 - 그룹 멤버만" ON public.family_messages
  FOR SELECT
  USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_messages.group_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_messages.group_id
        AND g.owner_id = auth.uid()
    )
  );

-- 작성: 그룹 멤버만, sender_id = 로그인 사용자
CREATE POLICY "family_messages 작성 - 그룹 멤버만" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    group_id IS NOT NULL
    AND auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_messages.group_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_messages.group_id
          AND g.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "family_messages 수정 - 본인만" ON public.family_messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_messages.group_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_messages.group_id
          AND g.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_messages.group_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_messages.group_id
          AND g.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "family_messages 삭제 - 본인 또는 ADMIN" ON public.family_messages
  FOR DELETE
  USING (
    auth.uid() = sender_id
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_messages.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
      )
    )
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_messages.group_id
          AND g.owner_id = auth.uid()
      )
    )
  );
