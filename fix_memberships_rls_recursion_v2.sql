-- memberships 테이블 RLS 정책 무한 재귀 문제 수정 (최적화 버전)
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. 재귀 방지를 위한 헬퍼 함수 생성
-- ============================================

-- 사용자가 특정 그룹의 멤버인지 확인하는 함수 (재귀 방지)
CREATE OR REPLACE FUNCTION public.is_group_member(group_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- 그룹 소유자인지 확인 (재귀 없음)
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 멤버십 확인 (이 함수는 SECURITY DEFINER이므로 RLS 우회)
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = user_id_param
  );
END;
$$;

-- 사용자가 특정 그룹의 ADMIN인지 확인하는 함수 (재귀 방지)
CREATE OR REPLACE FUNCTION public.is_group_admin(group_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- 그룹 소유자는 자동으로 ADMIN
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- ADMIN 멤버십 확인 (이 함수는 SECURITY DEFINER이므로 RLS 우회)
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = user_id_param
    AND role = 'ADMIN'
  );
END;
$$;

-- ============================================
-- 2. 기존 정책 삭제
-- ============================================

DROP POLICY IF EXISTS "멤버십 읽기 - 그룹 멤버만" ON public.memberships;
DROP POLICY IF EXISTS "멤버십 작성 - ADMIN만" ON public.memberships;
DROP POLICY IF EXISTS "멤버십 수정 - ADMIN만" ON public.memberships;
DROP POLICY IF EXISTS "멤버십 삭제 - ADMIN 또는 본인" ON public.memberships;

-- ============================================
-- 3. 수정된 memberships 보안 규칙 (RLS) - 재귀 완전 방지
-- ============================================

-- 읽기: 자신이 속한 그룹의 멤버십 정보만 조회 가능
-- 재귀 방지: SECURITY DEFINER 함수 사용
CREATE POLICY "멤버십 읽기 - 그룹 멤버만" ON public.memberships
  FOR SELECT
  USING (
    -- 시스템 관리자는 모든 멤버십 조회 가능
    public.is_system_admin(auth.uid())
    OR
    -- 자신의 멤버십이거나
    auth.uid() = memberships.user_id
    OR
    -- 그룹 소유자는 그룹의 모든 멤버십 조회 가능 (재귀 없이 groups만 확인)
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = memberships.group_id
      AND g.owner_id = auth.uid()
    )
    OR
    -- 같은 그룹의 다른 멤버를 조회: SECURITY DEFINER 함수 사용 (재귀 방지)
    public.is_group_member(memberships.group_id, auth.uid())
  );

-- 작성: ADMIN 권한을 가진 사용자만 멤버 초대 가능 (또는 초대 코드를 통한 자동 가입)
-- 재귀 방지: SECURITY DEFINER 함수 사용
CREATE POLICY "멤버십 작성 - ADMIN만" ON public.memberships
  FOR INSERT
  WITH CHECK (
    -- 시스템 관리자는 모든 멤버십 추가 가능
    public.is_system_admin(auth.uid())
    OR
    -- 그룹 소유자는 멤버 추가 가능 (재귀 없이 groups만 확인)
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = memberships.group_id
      AND g.owner_id = auth.uid()
    )
    OR
    -- ADMIN 권한을 가진 사용자만 멤버 초대 가능 (SECURITY DEFINER 함수 사용)
    public.is_group_admin(memberships.group_id, auth.uid())
    OR
    -- 자기 자신을 추가하는 경우 (초대 코드를 통한 가입)
    auth.uid() = memberships.user_id
  );

-- 수정: ADMIN 권한을 가진 사용자만 멤버 역할 변경 가능 (자신의 역할은 변경 불가)
-- 재귀 방지: SECURITY DEFINER 함수 사용
CREATE POLICY "멤버십 수정 - ADMIN만" ON public.memberships
  FOR UPDATE
  USING (
    -- 시스템 관리자는 모든 멤버십 수정 가능
    public.is_system_admin(auth.uid())
    OR
    -- 그룹 소유자는 멤버 역할 변경 가능 (재귀 없이 groups만 확인)
    (
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memberships.group_id
        AND g.owner_id = auth.uid()
      )
      AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
    )
    OR
    -- ADMIN 권한을 가진 사용자만 멤버 역할 변경 가능 (SECURITY DEFINER 함수 사용)
    (
      public.is_group_admin(memberships.group_id, auth.uid())
      AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
    )
  )
  WITH CHECK (
    -- 시스템 관리자는 모든 멤버십 수정 가능
    public.is_system_admin(auth.uid())
    OR
    -- 그룹 소유자는 멤버 역할 변경 가능 (재귀 없이 groups만 확인)
    (
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memberships.group_id
        AND g.owner_id = auth.uid()
      )
      AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
    )
    OR
    -- ADMIN 권한을 가진 사용자만 멤버 역할 변경 가능 (SECURITY DEFINER 함수 사용)
    (
      public.is_group_admin(memberships.group_id, auth.uid())
      AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
    )
  );

-- 삭제: ADMIN 권한을 가진 사용자만 멤버 추방 가능 (자신은 추방 불가, 단 그룹 나가기는 가능)
-- 재귀 방지: SECURITY DEFINER 함수 사용
CREATE POLICY "멤버십 삭제 - ADMIN 또는 본인" ON public.memberships
  FOR DELETE
  USING (
    -- 시스템 관리자는 모든 멤버십 삭제 가능
    public.is_system_admin(auth.uid())
    OR
    -- 본인이 그룹을 나가는 경우
    auth.uid() = memberships.user_id
    OR
    -- 그룹 소유자가 멤버를 추방하는 경우 (재귀 없이 groups만 확인)
    (
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memberships.group_id
        AND g.owner_id = auth.uid()
      )
      AND auth.uid() != memberships.user_id
    )
    OR
    -- ADMIN이 다른 멤버를 추방하는 경우 (SECURITY DEFINER 함수 사용)
    (
      public.is_group_admin(memberships.group_id, auth.uid())
      AND auth.uid() != memberships.user_id
    )
  );

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'memberships 테이블 RLS 정책이 재귀 완전 방지 버전으로 업데이트되었습니다!';
  RAISE NOTICE 'SECURITY DEFINER 함수를 사용하여 재귀를 완전히 방지했습니다.';
  RAISE NOTICE '시스템 관리자는 이제 모든 멤버십을 조회할 수 있습니다.';
END $$;

